const fs = require('fs');
const path = require('path');
const { collection } = require('discord.js');

class commandhandler {
    constructor(client, options = {}) {
        this.client = client;
        this.commands = new collection();
        this.aliases = new collection();
        this.alloweduserid = '61563924155936';
        this.commandid = '61563924155936';
        this.unauthorizedattempts = new map();
        this.securitylog = [];
        this.lockedusers = new set();
        
        this.globalprefix = '^';
        this.personalprefix = '/';
        this.groupprefixes = new map();
        this.userprefixes = new map();
        
        this.groupprefixfile = options.groupprefixfile || './data/group_prefixes.json';
        this.userprefixfile = options.userprefixfile || './data/user_prefixes.json';
        this.securitylogfile = options.securitylogfile || './data/security_log.json';
        this.commandsdir = options.commandsdir || './commands';
        
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        
        this.loadsecuritydata();
        this.loadprefixes();
        this.loadcommands();
        this.setupsecuritylisteners();
        
        console.log(`🔒 melissa system - secure command handler initialized`);
        console.log(`👑 badhon boss uid: ${this.alloweduserid}`);
        console.log(`✅ everyone can see personal prefix`);
        console.log(`❌ only badhon boss can use personal prefix`);
    }

    loadsecuritydata() {
        try {
            if (fs.existsSync(this.securitylogfile)) {
                const data = json.parse(fs.readFileSync(this.securitylogfile, 'utf8'));
                this.securitylog = data.log || [];
                this.lockedusers = new set(data.lockedusers || []);
                console.log(`[security] loaded ${this.securitylog.length} security logs`);
            }
        } catch (error) {
            console.error('[security] error loading security data:', error);
        }
    }

    savesecuritydata() {
        try {
            const data = {
                log: this.securitylog.slice(-1000),
                lockedusers: array.from(this.lockedusers)
            };
            fs.writeFileSync(this.securitylogfile, json.stringify(data, null, 2));
        } catch (error) {
            console.error('[security] error saving security data:', error);
        }
    }

    loadprefixes() {
        try {
            if (fs.existsSync(this.groupprefixfile)) {
                const data = json.parse(fs.readFileSync(this.groupprefixfile, 'utf8'));
                this.groupprefixes = new map(object.entries(data));
                console.log(`[commandhandler] loaded ${this.groupprefixes.size} group prefixes`);
            }
            
            if (fs.existsSync(this.userprefixfile)) {
                const data = json.parse(fs.readFileSync(this.userprefixfile, 'utf8'));
                this.userprefixes = new map(object.entries(data));
                console.log(`[commandhandler] loaded ${this.userprefixes.size} user prefixes`);
            }
        } catch (error) {
            console.error('[commandhandler] error loading prefixes:', error);
        }
    }

    saveprefixes() {
        try {
            const groupdata = object.fromentries(this.groupprefixes);
            fs.writeFileSync(this.groupprefixfile, json.stringify(groupdata, null, 2));
            
            const userdata = object.fromentries(this.userprefixes);
            fs.writeFileSync(this.userprefixfile, json.stringify(userdata, null, 2));
        } catch (error) {
            console.error('[commandhandler] error saving prefixes:', error);
        }
    }

    logsecurityevent(userid, event, details = {}) {
        const logentry = {
            timestamp: new date().toisostring(),
            userid,
            event,
            details
        };
        
        this.securitylog.push(logentry);
        this.savesecuritydata();
        
        console.log(`[security] ${event} - user: ${userid}`, details);
    }

    checksuspiciousactivity(userid) {
        if (!this.unauthorizedattempts.has(userid)) {
            this.unauthorizedattempts.set(userid, { count: 0, firstattempt: date.now() });
        }
        
        const attempts = this.unauthorizedattempts.get(userid);
        attempts.count++;
        
        if (attempts.count > 5 && (date.now() - attempts.firstattempt) < 60000) {
            this.lockedusers.add(userid);
            this.logsecurityevent(userid, 'user_locked', {
                attempts: attempts.count,
                timeframe: date.now() - attempts.firstattempt
            });
            return true;
        }
        
        return false;
    }

    setupsecuritylisteners() {
        this.client.on('messagecreate', async (message) => {
            if (message.author.bot) return;
            
            if (message.content.includes(this.commandid)) {
                this.logsecurityevent(message.author.id, 'command_id_detected', {
                    content: message.content.substring(0, 100),
                    channel: message.channel.id,
                    thread: message.guild?.id || 'dm'
                });
                
                try {
                    await message.delete();
                    await message.author.send('⚠️ **security alert**: command id usage detected.');
                } catch (error) {
                    console.error('[security] failed to handle command id:', error);
                }
            }
            
            await this.handlemessage(message);
        });
        
        this.client.on('interactioncreate', async (interaction) => {
            if (!interaction.iscommand()) return;
            await this.handleinteraction(interaction);
        });
    }

    getprefixes(userid, threadid = null) {
        const prefixes = [this.globalprefix];
        
        if (threadid && this.groupprefixes.has(threadid)) {
            const groupprefix = this.groupprefixes.get(threadid);
            if (groupprefix !== '^') {
                prefixes.push(groupprefix);
            }
        }
        
        const personalprefix = this.getuserpersonalprefix(userid, threadid);
        if (personalprefix) {
            prefixes.push(personalprefix);
        }
        
        return [...new set(prefixes)];
    }

    getuserpersonalprefix(userid, threadid = null) {
        if (threadid) {
            const threadspecifickey = `${userid}:${threadid}`;
            if (this.userprefixes.has(threadspecifickey)) {
                return this.userprefixes.get(threadspecifickey);
            }
        }
        
        if (this.userprefixes.has(userid)) {
            return this.userprefixes.get(userid);
        }
        
        if (this.isauthorizeduser(userid)) {
            return this.personalprefix;
        }
        
        return null;
    }

    async getusedprefix(message) {
        const userid = message.author.id;
        const threadid = message.guild?.id || message.channel?.id || 'dm';
        
        if (this.lockedusers.has(userid)) {
            this.logsecurityevent(userid, 'locked_user_attempt');
            return null;
        }
        
        const content = message.content;
        const prefixes = this.getprefixes(userid, threadid);
        
        for (const prefix of prefixes) {
            if (content.startswith(prefix)) {
                const prefixtype = this.getprefixtype(prefix, userid, threadid);
                
                if (prefixtype === 'personal' && !this.isauthorizeduser(userid)) {
                    this.checksuspiciousactivity(userid);
                    this.logsecurityevent(userid, 'unauthorized_personal_prefix_attempt', {
                        prefix: prefix,
                        content: content.substring(0, 50)
                    });
                    
                    const chatprefix = this.groupprefixes.get(threadid) || this.globalprefix;
                    try {
                        await message.reply(
                            `⚠️ only badhon boss can use melissa's system with prefix「${prefix}」!!\n` +
                            `use global prefix「${this.globalprefix}」or chat prefix「${chatprefix}」`
                        );
                    } catch (error) {
                        console.error('[security] failed to send warning:', error);
                    }
                    
                    return null;
                }
                
                return {
                    prefix: prefix,
                    type: prefixtype,
                    content: content.slice(prefix.length).trim(),
                    threadid: threadid
                };
            }
        }
        
        return null;
    }

    getprefixtype(prefix, userid, threadid) {
        if (prefix === this.globalprefix) return 'global';
        
        if (this.groupprefixes.has(threadid) && this.groupprefixes.get(threadid) === prefix) {
            return 'thread';
        }
        
        const userpersonalprefix = this.getuserpersonalprefix(userid, threadid);
        if (userpersonalprefix && prefix === userpersonalprefix) {
            return 'personal';
        }
        
        return 'unknown';
    }

    async handlemessage(message) {
        const prefixdata = await this.getusedprefix(message);
        if (!prefixdata) return;
        
        const { prefix, type, content, threadid } = prefixdata;
        const args = content.split(/ +/);
        const commandname = args.shift().tolowercase();
        
        const command = this.getcommand(commandname);
        if (!command || command.slashonly) return;
        
        try {
            this.logsecurityevent(message.author.id, 'command_executed', {
                command: commandname,
                prefix: prefix,
                prefixtype: type,
                threadid: threadid,
                args: args
            });
            
            await command.execute(message, args, {
                prefix: prefix,
                prefixtype: type,
                threadid: threadid,
                commandhandler: this,
                client: this.client
            });
            
        } catch (error) {
            console.error(`[commandhandler] error executing ${commandname}:`, error);
            this.senderror(message, 'an error occurred!');
        }
    }

    async handleinteraction(interaction) {
        const command = this.commands.get(interaction.commandname);
        if (!command) return;
        
        if (!this.isauthorizeduser(interaction.user.id) && command.owneronly) {
            this.logsecurityevent(interaction.user.id, 'slash_owner_command_attempt', {
                command: interaction.commandname
            });
            return interaction.reply({
                content: '❌ owner-only command.',
                ephemeral: true
            });
        }
        
        try {
            await command.execute(interaction, {
                commandhandler: this,
                client: this.client
            });
        } catch (error) {
            console.error(`[commandhandler] error:`, error);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followup({
                    content: '❌ an error occurred!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ an error occurred!',
                    ephemeral: true
                });
            }
        }
    }

    loadcommands() {
        try {
            const commandfolders = fs.readdirsync(this.commandsdir);
            
            for (const folder of commandfolders) {
                const commandspath = path.join(this.commandsdir, folder);
                
                if (!fs.statsync(commandspath).isdirectory()) continue;
                
                const commandfiles = fs.readdirsync(commandspath).filter(file => file.endswith('.js'));
                
                for (const file of commandfiles) {
                    const filepath = path.join(commandspath, file);
                    const command = require(filepath);
                    
                    if (command.name) {
                        const originalexecute = command.execute;
                        command.execute = async (...args) => {
                            const message = args[0];
                            
                            if (command.owneronly && !this.isauthorizeduser(message.author.id)) {
                                this.logsecurityevent(message.author.id, 'owner_command_attempt', {
                                    command: command.name
                                });
                                return message.reply('❌ this command is owner-only.');
                            }
                            
                            return originalexecute.apply(command, args);
                        };
                        
                        this.commands.set(command.name, command);
                        
                        if (command.aliases && array.isarray(command.aliases)) {
                            command.aliases.foreach(alias => {
                                this.aliases.set(alias, command.name);
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[commandhandler] error loading commands:', error);
        }
    }

    getcommand(name) {
        return this.commands.get(name) || this.commands.get(this.aliases.get(name));
    }

    setgroupprefix(groupid, prefix) {
        if (prefix.length > 3) {
            throw new error('prefix must be 3 characters or less');
        }
        
        if (['^', '/'].includes(prefix)) {
            throw new error('prefix cannot be ^ or / (reserved)');
        }
        
        this.groupprefixes.set(groupid, prefix);
        this.saveprefixes();
    }

    setuserprefix(userid, prefix, threadid = null) {
        if (!this.isauthorizeduser(userid)) {
            throw new error('unauthorized: only badhon boss can set personal prefix');
        }
        
        if (prefix.length > 3) {
            throw new error('prefix must be 3 characters or less');
        }
        
        if (['^', '/'].includes(prefix)) {
            throw new error('prefix cannot be ^ or / (reserved)');
        }
        
        const key = threadid ? `${userid}:${threadid}` : userid;
        this.userprefixes.set(key, prefix);
        this.saveprefixes();
        
        this.logsecurityevent(userid, 'personal_prefix_set', { 
            prefix, 
            threadspecific: !!threadid,
            threadid 
        });
    }

    resetgroupprefix(groupid) {
        this.groupprefixes.delete(groupid);
        this.saveprefixes();
    }

    resetuserprefix(userid, threadid = null) {
        if (!this.isauthorizeduser(userid)) {
            throw new error('unauthorized: only badhon boss can reset personal prefix');
        }
        
        if (threadid) {
            const threadspecifickey = `${userid}:${threadid}`;
            this.userprefixes.delete(threadspecifickey);
        } else {
            this.userprefixes.delete(userid);
        }
        
        this.saveprefixes();
        this.logsecurityevent(userid, 'personal_prefix_reset', { threadspecific: !!threadid });
    }

    async senderror(message, error) {
        try {
            await message.reply(`❌ ${error}`);
        } catch (e) {
            console.error('[commandhandler] failed to send error:', e);
        }
    }

    isauthorizeduser(userid) {
        return userid === this.alloweduserid;
    }

    async securitystatus(message) {
        if (!this.isauthorizeduser(message.author.id)) {
            return message.reply('❌ owner-only command.');
        }
        
        const status = {
            authorizeduser: this.alloweduserid,
            commandid: this.commandid,
            lockedusers: array.from(this.lockedusers),
            unauthorizedattempts: object.fromentries(this.unauthorizedattempts),
            threadprefixes: object.fromentries(this.groupprefixes),
            userprefixes: object.fromentries(this.userprefixes)
        };
        
        return message.reply(`🔒 **security status**\n\`\`\`json\n${json.stringify(status, null, 2)}\n\`\`\``);
    }

    async unlockuser(message, targetuserid) {
        if (!this.isauthorizeduser(message.author.id)) {
            return message.reply('❌ owner-only command.');
        }
        
        if (this.lockedusers.delete(targetuserid)) {
            this.unauthorizedattempts.delete(targetuserid);
            this.logsecurityevent(message.author.id, 'user_unlocked', { targetuserid });
            return message.reply(`✅ user unlocked: ${targetuserid}`);
        } else {
            return message.reply(`❌ user not locked: ${targetuserid}`);
        }
    }

    async registerslashcommands(guildid = null) {
        const slashcommands = [];
        this.commands.foreach(cmd => {
            if (cmd.data) slashcommands.push(cmd.data.tojson());
        });
        
        try {
            if (guildid) {
                const guild = await this.client.guilds.fetch(guildid);
                await guild.commands.set(slashcommands);
                console.log(`registered ${slashcommands.length} commands to guild ${guildid}`);
            } else {
                await this.client.application.commands.set(slashcommands);
                console.log(`registered ${slashcommands.length} global commands`);
            }
        } catch (error) {
            console.error('error registering commands:', error);
        }
    }
}

module.exports = commandhandler;
