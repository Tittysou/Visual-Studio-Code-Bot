const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class DiscordFileSystemBot {
    constructor() {
        this.db = null;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds, 
                GatewayIntentBits.GuildMessages, 
                GatewayIntentBits.MessageContent
            ]
        });

        this.initDatabase();
        this.setupEventHandlers();
    }

    initDatabase() {
        this.db = new sqlite3.Database('./botdata.db', (err) => {
            if (err) console.error('Database connection error:', err.message);
            console.log('Connected to the SQLite database.');
        });

        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS guilds (
                guild_id TEXT PRIMARY KEY,
                total_folders INTEGER DEFAULT 0,
                total_files INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                folder_name TEXT,
                description TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guilds (guild_id)
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id INTEGER,
                file_name TEXT,
                content TEXT,
                file_type TEXT,
                size INTEGER,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (folder_id) REFERENCES folders (id)
            )`);
        });
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}!`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const prefix = '!';
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            try {
                switch(command) {
                    case 'help':
                        await this.helpCommand(message);
                        break;
                    case 'init':
                        await this.initCommand(message);
                        break;
                    case 'createfolder':
                        await this.createFolderCommand(message, args);
                        break;
                    case 'addfile':
                        await this.addFileCommand(message, args);
                        break;
                    case 'view':
                        await this.viewFileCommand(message, args);
                        break;
                    case 'list':
                        await this.listCommand(message);
                        break;
                    case 'deletefile':
                        await this.deleteFileCommand(message, args);
                        break;
                    case 'deletefolder':
                        await this.deleteFolderCommand(message, args);
                        break;
                    case 'stats':
                        await this.statsCommand(message);
                        break;
                    case 'export':
                        await this.exportCommand(message, args);
                        break;
                }
            } catch (error) {
                this.sendErrorEmbed(message.channel, error.message);
            }
        });
    }

    sendEmbed(channel, title, description, color = 0x0099ff) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
        return channel.send({ embeds: [embed] });
    }

    sendErrorEmbed(channel, errorMessage) {
        return this.sendEmbed(channel, '❌ Error', errorMessage, 0xff0000);
    }

    async helpCommand(message) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📖 Advanced File System Help')
            .setDescription('Powerful file management commands:')
            .addFields(
                { name: '`!init`', value: 'Initialize the virtual file system.' },
                { name: '`!createfolder <name> [description]`', value: 'Create a new folder with optional description.' },
                { name: '`!addfile <folder> <filename> <content>`', value: 'Add a file to a folder.' },
                { name: '`!view <folder> <filename>`', value: 'View file content.' },
                { name: '`!list`', value: 'List all folders and files.' },
                { name: '`!deletefile <folder> <filename>`', value: 'Delete a file.' },
                { name: '`!deletefolder <folder>`', value: 'Delete a folder.' },
                { name: '`!stats`', value: 'View file system statistics.' },
                { name: '`!export <folder>`', value: 'Export folder contents as a text file.' }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Manage your Discord file system with ease!' });

        return message.reply({ embeds: [helpEmbed] });
    }

    async initCommand(message) {
        const guildId = message.guild.id;

        return new Promise((resolve, reject) => {
            this.db.run(`INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)`, [guildId], (err) => {
                if (err) return reject(new Error('Failed to initialize file system.'));
                resolve(this.sendEmbed(message.channel, '📂 File System Initialized', 'The virtual file system is ready to use.', 0x00ff00));
            });
        });
    }

    async createFolderCommand(message, args) {
        if (args.length < 1) throw new Error('Please provide a folder name.');
        
        const folderName = args[0];
        const description = args.slice(1).join(' ') || 'No description provided';

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO folders (guild_id, folder_name, description, created_by) VALUES (?, ?, ?, ?)`, 
                [message.guild.id, folderName, description, message.author.username], 
                (err) => {
                    if (err) return reject(new Error('Failed to create folder.'));
                    resolve(this.sendEmbed(message.channel, '📁 Folder Created', 
                        `Folder \`${folderName}\` created\nDescription: ${description}`));
                }
            );
        });
    }

    async addFileCommand(message, args) {
        if (args.length < 3) throw new Error('Usage: !addfile <folder> <filename> <content>');
        
        const [folderName, fileName, ...fileContentArr] = args;
        const fileContent = fileContentArr.join(' ');

        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT id FROM folders WHERE guild_id = ? AND folder_name = ?`, 
                [message.guild.id, folderName], 
                (err, row) => {
                    if (!row) return reject(new Error('Folder not found.'));

                    this.db.run(
                        `INSERT INTO files (folder_id, file_name, content, file_type, size, created_by) VALUES (?, ?, ?, ?, ?, ?)`, 
                        [row.id, fileName, fileContent, path.extname(fileName), fileContent.length, message.author.username], 
                        (err) => {
                            if (err) return reject(new Error('Failed to add file.'));
                            resolve(this.sendEmbed(message.channel, '📝 File Added', 
                                `File \`${fileName}\` added to folder \`${folderName}\``));
                        }
                    );
                }
            );
        });
    }

    async viewFileCommand(message, args) {
        if (args.length !== 2) throw new Error('Usage: !view <folder> <filename>');
        
        const [folderName, fileName] = args;

        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT content FROM files 
                WHERE folder_id = (SELECT id FROM folders WHERE guild_id = ? AND folder_name = ?) 
                AND file_name = ?`,
                [message.guild.id, folderName, fileName],
                (err, row) => {
                    if (!row) return reject(new Error('File not found.'));
                    resolve(this.sendEmbed(message.channel, `📄 ${fileName}`, 
                        `\`\`\`${row.content}\`\`\``));
                }
            );
        });
    }

    async listCommand(message) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT id, folder_name FROM folders WHERE guild_id = ?`, [message.guild.id], (err, folders) => {
                if (err) return reject(new Error('An error occurred while fetching data.'));
                if (!folders.length) return this.sendEmbed(message.channel, '📂 File System', 'No folders available.', 0xff0000);

                const listEmbeds = [];
                let currentEmbed = new EmbedBuilder()
                    .setTitle('📂 File System')
                    .setColor(0x0099ff);

                let currentDescription = '';

                folders.forEach((folder, index) => {
                    this.db.all(
                        `SELECT file_name, content FROM files WHERE folder_id = ?`,
                        [folder.id],
                        (err, files) => {
                            if (err) return reject(new Error('An error occurred while fetching files.'));

                            let folderEntry = `📁 **${folder.folder_name}**\n`;
                            if (files.length > 0) {
                                files.forEach((file) => {
                                    folderEntry += `   └── 🗃️ ${file.file_name}\n`;
                                });
                            } else {
                                folderEntry += `   └── ❌ No files\n`;
                            }

                            if ((currentDescription + folderEntry).length > 4000) {
                                listEmbeds.push(currentEmbed.setDescription(currentDescription));
                                currentEmbed = new EmbedBuilder()
                                    .setTitle('📂 File System (Continued)')
                                    .setColor(0x0099ff);
                                currentDescription = '';
                            }

                            currentDescription += folderEntry;

                            if (index === folders.length - 1) {
                                if (currentDescription) {
                                    listEmbeds.push(currentEmbed.setDescription(currentDescription));
                                }

                                message.channel.send({ embeds: listEmbeds });
                                resolve();
                            }
                        }
                    );
                });
            });
        });
    }

    async deleteFileCommand(message, args) {
        if (args.length !== 2) throw new Error('Usage: !deletefile <folder> <filename>');
        
        const [folderName, fileName] = args;

        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM files 
                WHERE folder_id = (SELECT id FROM folders WHERE guild_id = ? AND folder_name = ?) 
                AND file_name = ?`,
                [message.guild.id, folderName, fileName],
                (err) => {
                    if (err) return reject(new Error('File not found.'));
                    resolve(this.sendEmbed(message.channel, '❌ File Deleted', 
                        `File \`${fileName}\` deleted from \`${folderName}\``));
                }
            );
        });
    }

    async deleteFolderCommand(message, args) {
        if (args.length < 1) throw new Error('Please provide a folder name.');
        
        const folderName = args.join(' ');

        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM folders WHERE guild_id = ? AND folder_name = ?`, 
                [message.guild.id, folderName], 
                (err) => {
                    if (err) return reject(new Error('Folder not found.'));
                    resolve(this.sendEmbed(message.channel, '🗑 Folder Deleted', 
                        `Folder \`${folderName}\` deleted.`));
                }
            );
        });
    }

    async statsCommand(message) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    COUNT(DISTINCT folders.id) as total_folders, 
                    COUNT(files.id) as total_files 
                FROM folders 
                LEFT JOIN files ON folders.id = files.folder_id 
                WHERE folders.guild_id = ?`, 
                [message.guild.id], 
                (err, stats) => {
                    if (err) return reject(new Error('Failed to fetch statistics.'));
                    
                    resolve(this.sendEmbed(message.channel, '📊 File System Stats', 
                        `**Total Folders:** ${stats.total_folders}\n**Total Files:** ${stats.total_files}`));
                }
            );
        });
    }

    async exportCommand(message, args) {
        if (args.length !== 1) throw new Error('Usage: !export <folder>');
        
        const folderName = args[0];

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT file_name, content FROM files 
                WHERE folder_id = (SELECT id FROM folders WHERE guild_id = ? AND folder_name = ?)`,
                [message.guild.id, folderName],
                async (err, files) => {
                    if (err) return reject(new Error('Failed to export folder.'));
                    if (!files.length) return reject(new Error('No files in the folder.'));

                    const exportContent = files.map(file => 
                        `--- ${file.file_name} ---\n${file.content}\n\n`
                    ).join('');

                    try {
                        const exportFileName = `${folderName}_export_${Date.now()}.txt`;
                        
                        const fileBuffer = Buffer.from(exportContent, 'utf-8');

                        await message.channel.send({
                            content: `📦 Exported folder \`${folderName}\`:`,
                            files: [{
                                attachment: fileBuffer,
                                name: exportFileName
                            }]
                        });

                        resolve();
                    } catch (writeErr) {
                        reject(new Error('Failed to export folder.'));
                    }
                }
            );
        });
    }

    start() {
        this.client.login(process.env.DISCORD_TOKEN);
    }
}

const bot = new DiscordFileSystemBot();
bot.start();