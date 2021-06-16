const fs = require("fs");
const https = require("https");
const { promisify } = require("util");
const tmp = require("tmp");

const readFile = promisify(fs.readFile);

module.exports = function ({ bot, config, commands }) {

  const mentionRegex = /^<@?#?!?([0-9]+?)>$/;

  /**
   * Returns the snowflake ID in str, if any
   * @param {String} str
   * @returns {String|null}
   */
  function getSnowflake(str) {
    if (!str) return null;

    str = str.trim();

    if (isSnowflake(str)) {
      // User ID
      return str;
    } else {
      let mentionMatch = str.match(mentionRegex);
      if (mentionMatch) return mentionMatch[1];
    }

    return null;
  }

  const snowflakeRegex = /^[0-9]{17,}$/;
  function isSnowflake(str) {
    return str && snowflakeRegex.test(str);
  }

  /**
   * Returns whether the given member has permission to use modmail commands
   * @param {Eris.Member} member
   * @returns {boolean}
   */
  function isStaff(member) {
    if (!member) return false;
    if (config.inboxServerPermission.length === 0) return true;
    if (member.guild.ownerID === member.id) return true;

    return config.inboxServerPermission.some(perm => {
      if (isSnowflake(perm)) {
        // If perm is a snowflake, check it against the member's user id and roles
        if (member.id === perm) return true;
        if (member.roles.includes(perm)) return true;
      } else {
        // Otherwise assume perm is the name of a permission
        return member.permission.has(perm);
      }

      return false;
    });
  }

  /**
   * Turns the given attachment into a file object that can be sent forward as a new attachment
   * @param {Eris.Attachment} attachment
   * @returns {Promise<Eris.MessageFile>}
   */
  async function attachmentToDiscordFileObject(attachment) {
    const downloadResult = await downloadAttachment(attachment);
    const data = await readFile(downloadResult.path);
    downloadResult.cleanup();
    return { file: data, name: attachment.filename };
  }

  /**
   * @type {DownloadAttachmentFn}
   */
  const downloadAttachment = (attachment, tries = 0) => {
    return new Promise((resolve, reject) => {
      if (tries > 3) {
        console.error("Attachment download failed after 3 tries:", attachment);
        reject("Attachment download failed after 3 tries");
        return;
      }

      tmp.file((err, filepath, fd, cleanupCallback) => {
        const writeStream = fs.createWriteStream(filepath);

        https.get(attachment.url, (res) => {
          res.pipe(writeStream);
          writeStream.on("finish", () => {
            writeStream.end();
            resolve({
              path: filepath,
              cleanup: cleanupCallback
            });
          });
        }).on("error", (err) => {
          fs.unlink(filepath);
          console.error("Error downloading attachment, retrying");
          resolve(downloadAttachment(attachment, tries++));
        });
      });
    });
  };

  /**
   * 
   */
  msgCmd = async (msg, args) => {
    // Check if invoking member is staff since global command
    if (!isStaff(msg.member)) return;

    // Accumulate the mentioned users to ping in message
    let allowedMentionIds = [];
    const words = args.text ? args.text.split(/\s+/) : [];
    for (const word of words) {
      let mention = getSnowflake(word);
      if (mention) allowedMentionIds.push(mention);
    }

    const channelId = getSnowflake(args.channelId);

    // Reply to message via message link if passed
    if (!channelId) {
      const ids = args.channelId.match(/\S*?([0-9]{18})\/([0-9]{18})\/([0-9]{18})/);
      if (!ids) {
        bot.createMessage(msg.channel.id, "Invalid channel!");
        return;
      }

      const channel = bot.getChannel(ids[2]);
      if (typeof channel === 'undefined') {
        bot.createMessage(msg.channel.id, "Invalid channel!");
        return;
      }

      if (msg.attachments.length > 0) {
        let file = await attachmentToDiscordFileObject(msg.attachments[0]);
        bot.createMessage(ids[2], {
          content: args.text ? args.text : '',
          allowedMentions: {
            users: allowedMentionIds,
            repliedUser: true
          },
          messageReference: {
            messageID: ids[3],
            failIfNotExists: false
          }
        },
          file).catch(e => { console.log(e); });
        bot.createMessage(msg.channel.id, "Reply sent with attachment!");
        return;
      }

      if (!args.text) {
        bot.createMessage(msg.channel.id, "Message needed!");
        return;
      }

      bot.createMessage(ids[2], {
        content: args.text,
        allowedMentions: {
          users: allowedMentionIds,
          repliedUser: true
        },
        messageReference: {
          messageID: ids[3],
          failIfNotExists: false
        }
      }).catch(e => { console.log(e); });
      bot.createMessage(msg.channel.id, "Reply sent!");
      return;
    };

    const channel = bot.getChannel(channelId);
    if (typeof channel === 'undefined') {
      bot.createMessage(msg.channel.id, "Invalid channel!");
      return;
    }

    if (msg.attachments.length > 0) {
      let file = await attachmentToDiscordFileObject(msg.attachments[0]);
      bot.createMessage(channelId, {
        content: args.text ? args.text : '',
        allowedMentions: {
          users: allowedMentionIds
        },
      },
        file).catch(e => { console.log(e); });
      bot.createMessage(msg.channel.id, "Message sent with attachment!");
      return;
    }

    if (!args.text) {
      bot.createMessage(msg.channel.id, "Message needed!");
      return;
    }
    bot.createMessage(channelId, {
      content: args.text,
      allowedMentions: {
        users: allowedMentionIds
      }
    }).catch(e => { console.log(e); });
    bot.createMessage(msg.channel.id, "Message sent!");
    return;
  }

  commands.addGlobalCommand("msg",
    [
      { name: "channelId", type: "string", required: true },
      { name: "text", type: "string", required: false, catchAll: true }
    ],
    msgCmd);
}
