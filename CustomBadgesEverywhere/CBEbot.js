const Discord = require('discord.js');
const client = new Discord.Client();
const mariadb = require('mariadb');
const crypto = require('crypto');
const wget = require("wget");
const fs = require('fs');
const config = require('./config.json');

const pool = mariadb.createPool({host: config.dbData.host, user: config.dbData.user, password:config.dbData.pass, database:config.dbData.dbname, connectionLimit: 5});
const prefix = config.prefix, staffPrefix = config.staffPrefix;

let staff = [];
let cachedMessages = [];


// Universal Functions
async function fallargs(args, from)
{
  let temp = "";
  from = parseInt(from);
  console.log(args);
  if(args.length == from) return null;
  for(i = from; i < args.length; i++)
  {
    temp += args[i] + " ";
  }
  return temp;
}

function genstr(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  
  return text;
}

async function isStaff(message)
{
  let isfromstaff = false;
  let results = await staff.filter(x => x.id == message.author.id)

  results.length > 0 ? isfromstaff = {level: results.level, hasAccess: true} : isfromstaff = {level: results.level, hasAccess: false};
  return isfromstaff;
}

async function isCached(message)
{
  let iscached;
  let results = await cachedMessages.filter(x => x.embedMessage.id == message.id)
  //console.log(results);
  results.length > 0 ? iscached = {message: results[0].message, embedMessage: results[0].embedMessage, userData: results[0].userData, invPage: results[0].invPage, cached: true} : iscached = false;
  return iscached;
}

async function loadConfig()
{
    let conn;
    try {
        conn = await pool.getConnection();
        let staffData = await conn.query("SELECT * FROM `users` WHERE planID BETWEEN 5 AND 6");
        
        staffData.forEach(async data => {
            await staff.push({id: data.userID, level: data.planID});
        });

        console.log(staff);
    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();
    }
}

async function escapeSC(string)
{
  string = string.replace(/[\n]/g,'\\n');
  string = string.replace(/[\r]/g,'\\r');
  string = string.replace(/[\t]/g,'\\t');
  string = string.replace(/[\b]/g,'\\b');
  string = string.replace(/[\f]/g,'\\f');

  return string;
}

async function showBadgesInvEmbed(message, embedMessage, userData, invPage, reactData)
{ 
  let conn;
  try {
    conn = await pool.getConnection();
    let badgesData = await conn.query("SELECT * FROM `badges`");
    let currentBadge = await badgesData.find(x => x.id == userData.badges[invPage]);
    for(i = 0; i < cachedMessages.length; i++)
    {
      if(cachedMessages[i].embedMessage.id == embedMessage.id) cachedMessages[i].invPage = invPage;
    }

    if(reactData) reactData.remove(message.author);

    console.log(currentBadge);
    currentBadge.createdBy = await message.guild.members.find(x => x.id == currentBadge.createdBy);

    await embedMessage.edit({embed: {
        title: currentBadge.name,
        color: 0xffffff,
        thumbnail: {
            url: currentBadge.image
        },
        author: {
            name: currentBadge.createdBy.user.username,
            icon_url: currentBadge.createdBy.user.displayAvatarURL
        },
        description: `**Global?** ${currentBadge.global}\n\n${1 + invPage}/${userData.badges.length}`
    }});
    console.log(invPage);
  } catch (err) {
      throw err;
  } finally {
      if (conn) return conn.end();
  }
}

function sha256(data) {
  return crypto.createHash("sha256").update(data, "binary").digest("base64");
}

// Command Functions

// Users Commands
async function helpCMD(message)
{
  await message.channel.send({embed: {
    color: 0xf1c40f,
    title: `Helpy Commands`,
    description: "<> - required, [] - optional",
    fields: [
      {
        name: "help",
        value: "◆ Shows this list!"
      },
      {
        name: "mybadges",
        value: "◆ Shows your Badges Inventory!"
      }
    ]
  }});
}

async function myBadgesCMD(message)
{
    let conn;
    try {
        conn = await pool.getConnection();
        let userData = await conn.query("SELECT * FROM `users` WHERE `userID` = ?", [message.author.id]);
        
        userData[0].badges = JSON.parse(userData[0].badges);
        console.log(userData[0]);
        let embedMessage = await message.channel.send({embed: {
            title: `Waiting for DB response!`,
            color: 0xffffff,
            footer:
            {
                text: `${message.author.username}'s Badges`,
                icon_url: message.author.displayAvatarURL  
            }
        }});
        if(userData[0].badges.length == 0) return embedMessage.edit({embed: {
          title: `No badges found!`,
          color: 0xff0000,
          footer:
          {
              text: `${message.author.username}'s Badges`,
              icon_url: message.author.displayAvatarURL  
          }
        }})
        await embedMessage.react('🔽');
        await embedMessage.react('🔼');

        cachedMessages.push({message: message, embedMessage: embedMessage, userData: userData[0], invPage: 0});
        await showBadgesInvEmbed(message, embedMessage, userData[0], 0);

        setTimeout(async (embedMessage, message) => {
          message.delete();
          embedMessage.delete();
              for(i = 0; i < cachedMessages.length; i++)
          {
            if(cachedMessages[i].embedMessage.id == embedMessage.id) cachedMessages.splice(i, 1);
          }
        }, 120000, embedMessage, message);

    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();
    }
}

async function addCustomBadgeCMD(message, args, stage, badgeData)
{
  let data = badgeData ? badgeData : {};
  if(!stage)
  {
    let askfName = await message.channel.send({embed: {
        title: `Creating Custom Badge... 1/5`,
        description: `Okey buddy, tell me how are you going to name\nyour new shiny badge?\n\nAuto abort in 2 minutes or type \`cancel\``,
        color: parseInt((0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6), 16),
        footer: {
          text: message.author.username,
          icon_url: message.author.displayAvatarURL
        }
    }});
    let badgeNameMessage = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000, errors: ['time'] }).catch(error => console.error(error.title));
    if(badgeNameMessage.first().content.toLowerCase().startsWith("cancel")) return askfName.delete() && badgeNameMessage.first().delete() && message.react('😭');
    
    data.badgeName = await escapeSC(badgeNameMessage.first().content.toString());
    await askfName.delete();
    await badgeNameMessage.first().delete();
    return addCustomBadgeCMD(message, args, 2, data)
  }
  if(stage === 2)
  {
    let askfImage = await message.channel.send({embed: {
        title: `Creating Custom Badge... 2/5`,
        description: `So, \`${data.badgeName}\` you say! Thats cool... Now can you send image of the badge\n**Note: For well looking badges,\nplease try to use around 1:1 ratio images without white spaces!**\n\nAuto abort in 2 minutes or type \`cancel\``,
        color: parseInt((0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6), 16),
        footer: {
          text: message.author.username,
          icon_url: message.author.displayAvatarURL
        }
    }});
    let badgeImageMessage = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000, errors: ['time'] }).catch(error => console.error(error.title));
    if(badgeImageMessage.first().content.toLowerCase().startsWith("cancel")) return askfImage.delete() && badgeImageMessage.first().delete() && message.react('😭');
    if(!badgeImageMessage.first().attachments.first()) return addCustomBadgeCMD(message, args, 2, data); 
    
    let checkFormat = /\d.*\/*\.([a-z]{3,4})/.exec(badgeImageMessage.first().attachments.first().url);

    if(checkFormat[1] == "png" || checkFormat[1] == "jpeg" || checkFormat[1] == "gif" || checkFormat[1] == "jpg") { data.badgeIcon = badgeImageMessage.first().attachments.first().url;data.badgeIconType = checkFormat[1];}
    else
    { await askfImage.delete();
      let warnMessage = await message.channel.send({embed: {
        title: `Wrong Format`,
        description: `Please send an image in valid format: \`png, jpeg, gif, jpeg\``,
        color: 0xff0000,
      }});
      return setTimeout(async () => {
        await warnMessage.delete();
        addCustomBadgeCMD(message, args, 2, data)
      }, 1500, warnMessage);
    }
    await askfImage.delete();
    data.badgeIconRandomName = genstr(16);
    if(!fs.existsSync(`${process.env.HOME}/../var/www/html/cbapi/cbimages/${message.author.id}`)) fs.mkdirSync(`${process.env.HOME}/../var/www/html/cbapi/cbimages/${message.author.id}`);
    let download = await wget.download(data.badgeIcon, `${process.env.HOME}/../var/www/html/cbapi/cbimages/${message.author.id}/${data.badgeIconRandomName}.${data.badgeIconType}`);
    download.on('error', async function(err) {
        console.log(err);
        let errMessage = await message.channel.send({embed: {
          title: `Opss..`,
          description: `**Well this is awkward...**\nSomething died, here is what we captured:\n\`\`\`${err}\`\`\``,
          color: 0xff0000,
        }});
        return setTimeout(async () => {
          await errMessage.delete();
        }, 3000, errMessage);
    });
    download.on('end', function(output) {
        console.log(output);
    });
    download.on('progress', async function(progress) {
        if(progress == 1) return setTimeout(async () => {
          await badgeImageMessage.first().delete();
          return addCustomBadgeCMD(message, args, 5, data)
        }, 3000, message, args, data);
    });
    
  }
  if(stage == 5)
  {
    let askfDone = await message.channel.send({embed: {
      title: `Creating Custom Badge... 5/5`,
      description: `**We skiped 2 stages as they are in development!!!**\nWohoo... Your badge is ready for the world, but first?\nDo you want really to add the following badge:\nType anything for \`yes\` or ...\n\nAuto abort in 2 minutes or type \`cancel\``,
      color: parseInt((0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6), 16),
      thumbnail: {
        url: `https://api.tosdev.ga/cb/api/badgesImages/${message.author.id}/${data.badgeIconRandomName}.${data.badgeIconType}`,
      },
      fields: [{
          name: "Badge Name:",
          value: data.badgeName
        }],
      footer: {
        text: message.author.username,
        icon_url: message.author.displayAvatarURL
      }
    }});
    let badgeDoneMessage = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000, errors: ['time'] }).catch(error => console.error(error.title));
    if(badgeDoneMessage.first().content.toLowerCase().startsWith("cancel")) return askfDone.delete() && badgeDoneMessage.first().delete() && message.react('😭');
    
    await askfDone.delete();
    await badgeDoneMessage.first().delete();
    return addCustomBadgeCMD(message, args, 6, data)
  }
  if(stage == 6)
  {
    let conn;
    try {
        conn = await pool.getConnection();
        let uploadData = await conn.query("INSERT INTO badges (name, image, createdBy) VALUES (?, ?, ?)", [data.badgeName, `https://api.tosdev.ga/cb/api/badgesImages/${message.author.id}/${data.badgeIconRandomName}.${data.badgeIconType}`, message.author.id]);
        console.log(uploadData);
        if(uploadData.affectedRows != 0)
        {
          let toAddMessage = await message.channel.send({embed: {
          title: `Sucess!`,
          description: `Your Custom Badges is now out for the world!\nIt got ID: \`${uploadData.insertId}\`\n**Would you like to have the badge?\`yes/no\`**`,
          color: 0x00ff00,
          thumbnail: {
            url: `https://api.tosdev.ga/cb/api/badgesImages/${message.author.id}/${data.badgeIconRandomName}.${data.badgeIconType}`
          },
          fields: [{
            name: "Badge Name:",
            value: data.badgeName
          }],
          footer: {
            text: message.author.username,
            icon_url: message.author.displayAvatarURL
          }
        }});
        let badgeWtHave = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000, errors: ['time'] }).catch(error => console.error(error.title));
        if(badgeWtHave.first().content.toLowerCase().startsWith("n")) return toAddMessage.delete() && badgeWtHave.first().delete();
        else
        {
          let userData = await conn.query("SELECT * FROM users WHERE userID = ?", [message.author.id]);
          if(userData.length != 0)
          {
            userData[0].badges = JSON.parse(userData[0].badges);
            userData[0].badges.push(uploadData.insertId);
            userData[0].badges = JSON.stringify(userData[0].badges);
            await conn.query("UPDATE users SET badges = ? WHERE userID = ?", [userData[0].badges, message.author.id]);
          }
          else
          {
            await conn.query("INSERT INTO users (userID, badges, plan) VALUES (?, ?, ?)", [message.author.id, `[3, ${uploadData.insertId}]`, message.author.id]);
          }
        }
      }


    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();
    }
  }
}

// Staff Commands

async function embedCMD(message, args)
{ 
  let isPoll = false;
  let embedColor = null;

  if(args.length == 0) return message.channel.send({embed: {
    color: 0xff0000,
    description: `There is nothing to embed!`
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
  let sentMsg =  await message.channel.send({embed: {
    color: embedColor ? embedColor : 0xf1c40f, //0xf1c40f
    description: `${mtoembed}`
  }});
  message.delete();
  if(isPoll)
  {
    let yE = await getValue(message.guild.id, "yesEmoji");
    let nE = await getValue(message.guild.id, "noEmoji");
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

client.on('ready', async () => {
    console.log(`Hey, Helpy is online! [${new Date}]`);
    client.user.setActivity('ToS#3333 coding...', { type: 'WATCHING' }); 
    await loadConfig();
});


client.on("message", async (message) => {
  
    if(message.author.bot) return; 
    if(!message.guild) return;
    //console.log(message.mentions.members.first())
    if(message.mentions.members.first() && message.mentions.members.first().id == client.user.id) message.author.send(`Hey ${message.mentions.members.first()}, my prefix is \`${prefix}\``);

    if(message.content.startsWith(prefix))
    {
        let args = message.content.substring(prefix.length).split(" ");
        let command = args.shift();
        switch(command)
        {
          case "help":
            return helpCMD(message);
          
          case "mybadges":
            return myBadgesCMD(message);
          
          case "createbadge": 
            return addCustomBadgeCMD(message, args);
        }    
    }
    else if(message.content.startsWith(staffPrefix))
    {
        let staff = await isStaff(message);
        if(!staff.hasAccess) return;

        let args = message.content.substring(staffPrefix.length).split(" ");
        let command = args.shift();
        switch(command)
        {
          case "embed":
              return embedCMD(message, args);
          
          case "purge":
              return purgeCMD(message, args);
        } 
    }  
});
  
client.on("messageReactionAdd", async (reaction, user) => {
  if(user.bot) return;
  let cached = await isCached(reaction.message);
  if(!cached.cached) return;
  if(cached.userData.userID != user.id) return;
  switch (reaction.emoji.name)
  {
    case '🔽':
      console.log(`${user.tag} clicked ${reaction.emoji.name}`);
      if(cached.invPage == -1 + cached.userData.badges.length) return showBadgesInvEmbed(cached.message, cached.embedMessage, cached.userData, cached.invPage, reaction)
      else return showBadgesInvEmbed(cached.message, cached.embedMessage, cached.userData, 1 + cached.invPage, reaction)
    case '🔼': 
      console.log(`${user.tag} clicked ${reaction.emoji.name}`);
      if(cached.invPage == 0) return showBadgesInvEmbed(cached.message, cached.embedMessage, cached.userData, cached.invPage, reaction)
      else return showBadgesInvEmbed(cached.message, cached.embedMessage, cached.userData, -1 + cached.invPage, reaction)
  }
});

client.login(config.token);