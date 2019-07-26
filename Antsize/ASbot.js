const Discord = require('discord.js');
const client = new Discord.Client();
const ms = require('ms');
const fs = require('fs');

const config = require('./config.json');
const prefix = config.prefix;

let defaultServer, yE, nE, mutedRole, anChannel, evChannel, weChannel, ruChannel, autoRole;
let staffRoles = [];
let commands = ['ev', 'an', 'ru', 'we', 've', 'help', 'purge', 'kick', 'ban', 'mute', 'warn', 'warns'];

// Universal Functions
async function fallargs(args, from)
{
  let temp = "";
  from = parseInt(from);
  console.log(args);
  if(args.length == from) return null;
  for(i = from; i < args.length; i++)
  {
    if(i != -1 + args.length) temp += args[i] + " ";
    else temp += args[i];
  }
  return temp;
}

async function resolveDataFromConfig()
{
    defaultServer = await client.guilds.find(x => x.id == config.server);
    yE = await defaultServer.emojis.find(x => x.id == config.yE);
    nE = await defaultServer.emojis.find(x => x.id == config.nE);
    mutedRole = await defaultServer.roles.find(x => x.id == config.mutedRoleID);
    anChannel = await defaultServer.channels.find(x => x.id == config.anChannelID);
    evChannel = await defaultServer.channels.find(x => x.id == config.evChannelID);
    weChannel = await defaultServer.channels.find(x => x.id == config.weChannelID);
    ruChannel = await defaultServer.channels.find(x => x.id == config.ruChannelID);
    veChannel = await defaultServer.channels.find(x => x.id == config.veChannelID);
    autoRole = await defaultServer.roles.find(x => x.id == config.autoRoleID)
    config.rolePerms.forEach(async role => {
        staffRoles.push(role);
    });
}

async function hasStaffRole(message)
{
    let isfromstaff;
    await message.member.roles.forEach(async role => {
        let results = await staffRoles.filter(x => x.id == role.id)
        //console.log(role.name);
        //console.log(staffRoles);
        if(!isfromstaff) results.length > 0 ? isfromstaff = {id: results[0].id, allowedCommands: results[0].allowedCommands} : null;
    });
    return isfromstaff;
  
}

// Command Functions

async function helpCMD(message, args)
{
    await message.author.send({embed: {
        color: 0xf1c40f,
        title: `List of commands`,
        description: "<> - required, [] - optional",
        fields: [
            {
                name: "help",
                value: "**\n**"
            },
            {
                name: "ev <*message*> [*--color 0x00ff00*] [*-poll**]",
                value: "**\n**"
            },
            {
                name: "an <*message*> [*--color 0x00ff00*] [*-poll**]",
                value: "**\n**"
            },
            {
                name: "we <*message*> [*--color 0x00ff00*] [*-poll**]",
                value: "**\n**"
            },
            {
                name: "ru <*message*> [*--color 0x00ff00*] [*-poll**]",
                value: "**\n**"
            },
            {
                name: "ve <*message*> [*--color 0x00ff00*] [*-poll**]",
                value: "**\n**"
            },
            {
                name: "purge <*amount of messages*>",
                value: "**\n**"
            },
            {
                name: "mute <*@user or userID*> <*human time | 2d/days 1h/hour 35m/minutes 1s/second*>",
                value: "**\n**"
            },
            {
                name: "kick <*@user or userID*> <*reason*>",
                value: "**\n**"
            },
            {
                name: "ban <*@user or userID*> <*reason*>",
                value: "**\n**"
            },
            {
                name: "warn <*@user or userID*> <*reason*>",
                value: "**\n**"
            },
            {
                name: "warns [*@user or userID*]",
                value: "**\n**"
            }
            
        ]
    }});
    
}

async function embedCMD(message, channel, everyone, args)
{ 
  let isPoll = false;
  let embedColor = null;

  if(args.length == 0) return message.channel.send({embed: {
    color: 0xff0000,
    description: `There is nothing to emebed!`
  }});

  let poll = /\-\-poll /gm;
  let color = /\-\-color (\S*) /gm;
  let mtoembed = await fallargs(args, 0);

  let checkPoll = await poll.exec(mtoembed);
  let checkColor = await color.exec(mtoembed);
  if(checkPoll) 
  { 
    mtoembed = mtoembed.replace(poll, "");
    isPoll = true;
  }
  else if(checkColor) 
  { 
    mtoembed = mtoembed.replace(`${checkColor[0]}`, "");
    embedColor = checkColor[1];
  }
  
  console.log(`${embedColor} | ${isPoll}`)
  
  if(!mtoembed) return message.channel.send({embed: {
    color: 0xff0000,
    description: `There is nothing to emebed!`
  }});
  embedColor = parseInt(embedColor, 16);
  let sentMsg =  await channel.send(everyone ? `@everyone` : `@here`, {embed: {
    color: embedColor ? embedColor : 0xf1c40f, //0xf1c40f
    description: `${mtoembed}`,
    timestamp: new Date(),
    footer: 
    {
        icon_url: message.author.displayAvatarURL,
        text: message.author.tag
    }
  }});
  message.delete();
  if(isPoll)
  {
    await sentMsg.react(yE);
    await sentMsg.react(nE);
  }
}

async function purgeCMD(message, args)
{
    await message.delete();
    let queries = [], messages;
    if(args.length == 0) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Please type an amount of messages\nyou want to delete!`
    }});

    if(isNaN(args[0])) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Expected an integer`
    }});

    let aTD = args[0] > 100 ? 100 : args[0];

    let queryNumber = Math.ceil(args[0] / aTD);
    
    let lastMessageID = null;
    for (i=0; i< queryNumber; i++) {
        if(lastMessageID) messages = await message.channel.fetchMessages({ limit: aTD, before: lastMessageID });
        else messages = await message.channel.fetchMessages({ limit: aTD });
        console.log(messages.array().length)
        if(messages.array().length == 0) { i = queryNumber;  break;}
        queries.push(messages);
        lastMessageID = await messages.last().id;
    }

    for (i=0; i< queries.length; i++) {
        //console.log(`Deleting messages loop: ${i}`);
        await message.channel.bulkDelete(queries[i]).catch(console.error);
    }
}

async function kickCMD(message, args)
{
    if(!message.member.hasPermission('KICK_MEMBERS')) return message.channel.send({embed: {
        color: 0xff0000,
        title: `You don't have \`KICK_MEMBERS\` permission!`
    }});

    let mTB = message.mentions.members.first() || await message.guild.members.get(args[0])
    let rFB = await fallargs(args, 1);

    if(!mTB) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we hit dead end trying to\nfind who to throw the boots at...`
    }});

    if(!mTB.kickable) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like the user is too high for the boots!`
    }});

    await mTB.send({embed: {
        color: 0xff0000,
        thumbnail: {
            url: "https://media.tenor.com/images/69fe5462af64d7a9d1302fcc5eabbe3f/tenor.gif"
        },
        title: `Sorry but you got kicked!`,
        description: `**Reason:** \`${rFB}\``
    }});

    await mTB.kick(`Executor:${message.author.tag} | Reason: ${rFB}`).catch(err => message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we missed or something happend!`,
        description: err
    }}));

    return message.channel.send({embed: {
        color: 0x00ff00,
        thumbnail: {
            url: "https://media.tenor.com/images/69fe5462af64d7a9d1302fcc5eabbe3f/tenor.gif"
        },
        author: {
            text: mTB.user.tag,
            icon_url: mTB.user.displayAvatarURL
        },
        title: `The Kicking Boots has spoken!`,
        description: `**Reason:** \`${rFB}\``
    }})
}

async function banCMD(message, args)
{
    if(!message.member.hasPermission('BAN_MEMBERS')) return message.channel.send({embed: {
        color: 0xff0000,
        title: `You don't have \`BAN_MEMBERS\` permission!`
    }});

    let mTB = message.mentions.members.first() || await message.guild.members.get(args[0])
    let rFB = await fallargs(args, 1);
    
    if(!mTB) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we hit dead end trying to\nfind who to throw the hammer at...`
    }});

    if(!mTB.kickable) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like the user is too high for the hammer!`
    }});

    await mTB.send({embed: {
        color: 0xff0000,
        thumbnail: {
            url: "https://media.tenor.com/images/048b3da98bfc09b882d3801cb8eb0c1f/tenor.gif"
        },
        title: `Sorry but you got banned!`,
        description: `**Reason:** \`${rFB}\``
    }});

    await mTB.ban(`Executor:${message.author.tag} | Reason: ${rFB}`).catch(err => message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we missed or something happend!`,
        description: err
    }}));

    return message.channel.send({embed: {
        color: 0x00ff00,
        thumbnail: {
            url: "https://media.tenor.com/images/048b3da98bfc09b882d3801cb8eb0c1f/tenor.gif"
        },
        author: {
            text: mTB.user.tag,
            icon_url: mTB.user.displayAvatarURL
        },
        title: `The Ban Hammer has spoken!`,
        description: `**Reason:** \`${rFB}\``
    }})
}

async function muteCMD(message, args)
{
    if(!message.member.hasPermission('MANAGE_MESSAGES')) return message.channel.send({embed: {
        color: 0xff0000,
        title: `You don't have \`MANAGE_MESSAGES\` permission!`
    }});

    let mTB = message.mentions.members.first() || await message.guild.members.get(args[0])
    let tFM = await fallargs(args, 1);
    console.log(tFM);
    console.log(ms(args[1]));

    console.log(typeof(tFM));
    console.log(typeof(args[1]));

    if(!mTB) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we hit dead end trying to\nfind who to mute at...`
    }});

    if(mTB.hasPermission('MANAGE_MESSAGES')) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like the user is too high for the mute!`
    }});

    await mTB.send({embed: {
        color: 0xff0000,
        thumbnail: {
            url: "https://media.tenor.com/images/4ece715d3c37129626f97e163b63d20f/tenor.gif"
        },
        title: `Sorry but you got muted!`,
        description: `**For:** \`${ms(ms(tFM))}\``
    }});

    await mTB.addRole(mutedRole).catch(err => message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we missed or something happend!`,
        description: err
    }}));

    setTimeout(async () => {
        mTB.removeRole(mutedRole).catch(err => message.channel.send({embed: {
            color: 0xff0000,
            title: `Seems like we missed or something happend!`,
            description: err
        }}));

        mTB.send({embed: {
            color: 0x00ff00,
            thumbnail: {
                url: "https://media.tenor.com/images/4ece715d3c37129626f97e163b63d20f/tenor.gif"
            },
            title: `Yeyy... You have been unmuted!`
        }});

    }, ms(tFM), mTB);

    return message.channel.send({embed: {
        color: 0x00ff00,
        thumbnail: {
            url: "https://media.tenor.com/images/4ece715d3c37129626f97e163b63d20f/tenor.gif"
        },
        author: {
            text: mTB.user.tag,
            icon_url: mTB.user.displayAvatarURL
        },
        title: `The user was muted!!`,
        description: `**For:** \`${ms(ms(tFM))}\``
        
    }})
}

async function warnCMD(message, args)
{
    if(!message.member.hasPermission('MANAGE_MESSAGES')) return message.channel.send({embed: {
        color: 0xff0000,
        title: `You don't have \`MANAGE_MESSAGES\` permission!`
    }});

    let mTW = message.mentions.members.first() || await message.guild.members.get(args[0])
    let rFW = await fallargs(args, 1);
    if(!rFW) rFW = "*No Reason!*";

    if(!mTW) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we hit dead end...`
    }});

    await mTW.send({embed: {
        color: 0xff0000,
        thumbnail: {
            url: "https://media.tenor.com/images/ae6dbc7adf6421e696db33d9a85a80bf/tenor.gif"
        },
        title: `I see, you... Warned!!!`,
        description: `**Reason:** \`${rFW}\``
    }});

    let rawdata = fs.readFileSync('../warns.json');
    let warnData = JSON.parse(rawdata);

    warnData.warns.push({
        id: 1 + warnData.warns.length,
        userID: mTW.user.id,
        warnerID: message.author.id,
        reason: rFW
    });

    let data = JSON.stringify(warnData, null, 2);  
    fs.writeFileSync('../warns.json', data);

    return message.channel.send({embed: {
        color: 0x00ff00,
        thumbnail: {
            url: "https://media.tenor.com/images/ae6dbc7adf6421e696db33d9a85a80bf/tenor.gif"
        },
        author: {
            text: mTW.user.tag,
            icon_url: mTW.user.displayAvatarURL
        },
        title: `The user was warned!!`,
        description: `**Reason:** \`${rFW}\``
        
    }})
}

async function showWarnsCMD(message, args)
{
    let mTW = message.mentions.members.first() || await message.guild.members.get(args[0]) || message.member;

    if(!mTW) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Seems like we hit dead end...`
    }});

    let rawdata = fs.readFileSync('../warns.json');
    let warnData = JSON.parse(rawdata);
    let dTS = "";

    let results = warnData.warns.filter(x => x.userID == mTW.id);
    if(results.length == 0) dTS = `**This user does not have\nany warns, yet ;)**`;
    else 
    {
        results.sort(function(a, b) {
            return (b.id - a.id);
        });
        for(i=0;i<5;i++)
        {
            if(results[i]) dTS+=`**${1 + i}.** ${results[i].reason} | By: <@${results[i].warnerID}>\n`   
        }
    }

    return message.channel.send({embed: {
        color: 0x00ff00,
        thumbnail: {
            url: "https://media.tenor.com/images/ae6dbc7adf6421e696db33d9a85a80bf/tenor.gif"
        },
        author: {
            text: mTW.user.tag,
            icon_url: mTW.user.displayAvatarURL
        },
        title: `Last 5 Warns:`,
        description: dTS
        
    }})
}

client.on('ready', async () => {
    console.log(`Thank you for ordering a bot from ToS#3333`);
    client.user.setActivity('USAR', { type: 'WATCHING' }); 
    await resolveDataFromConfig();
});

client.on('error', async (error) => {
    console.error(error);
});

client.on("message", async (message) => {
  
    if(message.author.bot) return; 
    if(!message.guild) return;

    if(message.mentions.members.first()) if(message.mentions.members.first().id == client.user.id) return message.channel.send(`Hey ${message.author}, my prefix is \`${prefix}\``);
    
    if(!message.content.startsWith(prefix)) return;
    let args = message.content.substring(prefix.length).split(" ");
    let command = args.shift();
    console.log(command);
    let hAtC = await hasStaffRole(message);
    if(!hAtC || command === "") return;
    if(!hAtC.allowedCommands.includes(command) && commands.includes(command)) return message.channel.send({embed: {
        color: 0xff0000,
        title: `Your role is not allowed to use that command!`
    }});
    switch(command)
    {
        case "help":
            return helpCMD(message, args);

        case "an":
            return embedCMD(message, anChannel, true, args);
        
        case "ev":
            return embedCMD(message, evChannel, false, args);

        case "we":
            return embedCMD(message, weChannel, true, args);
        
        case "ru":
            return embedCMD(message, ruChannel, true, args);

        case "ve":
            return embedCMD(message, veChannel, true, args);

        case "purge":
            return purgeCMD(message, args);
        
        case "kick":
            return kickCMD(message, args);
        
        case "ban":
            return banCMD(message, args); 
        
        case "mute":
            return muteCMD(message, args); 

        case "warn":
            return warnCMD(message, args);
        
        case "warns":
            return showWarnsCMD(message, args);
    }    
});

client.on("guildMemberAdd", async (member) => {
    
    if(member.guild.id == defaultServer.id) member.addRole(autoRole);
    member.send({embed: {
        color: 0x00ff3e,
        title: `Welcome to ${member.guild.name}`,
        description: `Welcome ${member},\nImake sure to read the Verification and the Welcome channels for more information!`
    }});

});

client.login(config.token);