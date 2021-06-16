## A plugin for [Dragory's ModMail](https://github.com/dragory/modmailbot) that allows staff to message chat as the bot with commands
Communicate with other server members as the mod mail bot, sending messages, replying to users, and sending images

## Setup
In your config.ini file, add:
```
plugins[] = npm:YetAnotherConnor/MessageChat
```
and after you restart your bot, you are good to go!

## The Command
Parameters in <> are required, parameters in [] are optional.

This command can be used in either inbox or main server(s)

### Useage
Signature 1: `!msg <Channel> [Message]` - Creates a new message in given channel

Signature 2: `!msg <MessageLink> [Message]` - Replies to given message

- `Channel` can be either the channel's ID or mention
- `MessageLink` is the link to the message
- `Message` is the text to be sent in the message or reply. If this parameter is not used, an attachment must be sent with the command to create a message as the bot
