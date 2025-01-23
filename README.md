# Discord File System Bot

## Overview
A powerful Discord bot that provides a virtual file system management system within your Discord server.

## Features
- Create and manage folders
- Add and view files
- List folder contents
- Delete files and folders
- Export folder contents
- Basic file system statistics

## Prerequisites
- Node.js (v14+)
- Discord Bot Token
- Discord Developer Account

## Installation
1. Clone the repository
2. Run `npm install`
3. Create a `.env` file with your Discord token
   ```
   DISCORD_TOKEN=your_discord_bot_token
   ```
4. Run `node bot.js`

## Commands
- `!help`: Show all available commands
- `!init`: Initialize file system
- `!createfolder <name>`: Create a new folder
- `!addfile <folder> <filename> <content>`: Add a file
- `!view <folder> <filename>`: View file content
- `!list`: List all folders and files
- `!deletefile <folder> <filename>`: Delete a file
- `!deletefolder <folder>`: Delete a folder
- `!stats`: Show file system statistics
- `!export <folder>`: Export folder contents
- `!restart`: Restart the bot (admin only)

## Technologies
- Discord.js
- SQLite3
- Node.js

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit changes
4. Push to the branch
5. Create a pull request

## License
MIT License
