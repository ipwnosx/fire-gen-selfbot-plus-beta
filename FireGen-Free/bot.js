const Discord = require("discord.js");
const wget = require("wget");
const client = new Discord.Client();
const LineByLineReader = require('line-by-line');
const moment = require('moment');
const config = require("./config.json");
const table = require('markdown-table')

const mariadb = require('mariadb');
const pool = mariadb.createPool({host: 'localhost', user:'phpmyadmin', password:'#ToS875601', database:"FG-Free", connectionLimit: 10});

const prefix = config.prefix;

var dbconf = {
    guild: null,
    client_role: null,
    generate_channel: null,
    status_channel: null,
    delayMS: null,
    last_dev_message: null,
    count_channel: null
}

var staff = [];
var delayedUsers = [];


var gencodeing = null;
var nowadding = null;
var nowdeleting = null;

// Other Functions 
async function removeDelay(message)
{
    for(i = 0; i < delayedUsers.length; i++)
    {
        if(delayedUsers[i].id == message.author.id) return delayedUsers.splice(i, 1);
    }
}

async function isDelayed(message)
{
    console.log(delayedUsers);
    for(i = 0; i < delayedUsers.length; i++)
    {
        if(delayedUsers[i].id == message.author.id) return {
            delayed: true,
            time: delayedUsers[i].time
        };
    }
    return {
        delayed: false,
        time: 0
    };
}

async function isStaff(message)
{
  var isfromstaff = false;
  //console.log(staff);
  for(i = 0; i < staff.length; i++)
  {
        //console.log(row[i].staffId);
        //console.log(message.author.id);
    if(message.author.id == staff[i].toString())
    {
      console.log(message.author.username + "is accessing staff only command!");
      isfromstaff = true;
      break;
    }
  }
  return isfromstaff;
}

async function getAllUsersJoinedAt(message)
{

  let guild = await message.guild.fetchMembers();
  let members = await guild.members;

  var results = [];
  for( let [snowflake, member] of members)
  {
    var temp = {username: member.user.username, id: member.user.id, joinedAt: member.joinedTimestamp}
    await results.push(temp);
  }

  return results;
}

async function getFormatedData(user)
{
    var res;
    let conn = await pool.getConnection();
    try {
        res = await conn.query(`SELECT * FROM users WHERE userID = ${user.id}`);
        await conn.end();
    } catch (err) { throw err; }
    

    if(res[0]) var plans = res[0].plan.split(" + ");
    else return res;
    
    if(plans[0])
    {
        res[0].plan = plans[-1 + plans.length];
    }
    
    return res;
}

async function checkCustomers()
{
    let res = 0;

    await dbconf.guild.members.forEach(async member => {
        if(member.highestRole.id == dbconf.client_role.id)
        {
            let wow = await member.roles.has(dbconf.client_role.id);
            if(wow) res++
            //console.log(wow + " | " + member.user.username);
        }
    });

    dbconf.count_channel.setName("Free Customers: " + res);

    //return res;
}

function genstr(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    
    return text;
}

// Commands Functions

async function reloadConfig()
{
    let conn 
    try {
        conn = await pool.getConnection();
        const res = await conn.query("SELECT * FROM staff");
        if(res[0])
        {
            for(i = 0; i < res.length; i++)
            {
               staff.push(res[i].staffid);
            }
        } 

        const res2 = await conn.query("SELECT * FROM config");
        if(res2[0])
        {
            for(i = 0; i < res2.length; i++)
            {
                console.log(res2[i].type + ' | ' + res2[i].value);
                if(res2[i].type == "server-id") dbconf.guild = await client.guilds.find(x => x.id === res2[i].value);  
                else if(res2[i].type == "client-role-id") dbconf.client_role = await dbconf.guild.roles.find(x => x.id === res2[i].value);
                else if(res2[i].type == "generate-channel-id") dbconf.generate_channel = await client.channels.find(x => x.id === res2[i].value);
                else if(res2[i].type == "count-channel") dbconf.count_channel = await client.channels.find(x => x.id === res2[i].value);
                else if(res2[i].type == "status-channel-id") dbconf.status_channel = await client.channels.find(x => x.id === res2[i].value)//find("id", res2[i].value);
                else if(res2[i].type == "delay-ms") dbconf.delayMS = res2[i].value;
                else if(res2[i].type == "last-dev-message") dbconf.last_dev_message = res2[i].value;
            }
        }
        await conn.end();
    } catch (err) { throw err; }
    

    let msgs = await dbconf.status_channel.fetchMessages().catch(console.error);
    //console.log(msgs);    
        
    msgs.forEach(async msg => {
        await msg.delete();
    });

    //dbconf.status_channel.send(`Bot was started at \`${new Date()}\` ...\n\n\`Client Role\` was set to: ${dbconf.client_role}\n\`Generation Channel\` was set to: ${dbconf.generate_channel}\n\`Status Channel\` was set to: ${dbconf.status_channel}\n\`Last News:\` \n${dbconf.last_dev_message}`)
    dbconf.status_channel.send(`Bot was started at \`${new Date()}\` ...\n\n\`Generation Channel\` was set to: ${dbconf.generate_channel}\n\`Status Channel\` was set to: ${dbconf.status_channel}\n\`Last News:\` \n${dbconf.last_dev_message}`);
}

async function ping(message)
{
    if(!message.guild) return;
    
    message.delete().catch(console.error);
    const m = await message.channel.send("Ping?");
    m.edit(`**Pong!** Generation Latency is **${m.createdTimestamp - message.createdTimestamp}ms**. and Discord.JS API Latency is **${Math.round(client.ping)}ms**`);
}

async function statusAccByService(message, args)
{
    var sql1;
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query(`SELECT COUNT(*) FROM accounts WHERE atype = '${args[0]}'`);
        sql1 = res;
        await conn.end();
    } catch (err) { throw err; }
    
    //console.log(sql1);
    var res = Object.values(sql1);
    res = Object.values(res[0]);
    message.channel.send({embed: {
        color: 0x09419b,
        fields: [{
            name: `Status of ${args[0]}`,
            value: "Available: " + res,
            inline: true
          }]
    }});

    
}

async function statusAcc(message, args)
{
    console.log("Here!");
    if(!message.guild) return;
    console.log("Here!2");
    if(message.channel.id != dbconf.generate_channel.id)
    {
        let m = await message.channel.send(`You are only allowed to generate accounts in ${dbconf.generate_channel} channel!`);
        await message.delete().catch(console.error);
        return setTimeout(function (){
            m.delete();
        }, 5000);
    }
    console.log("Here!3");
    if(!args[0]) var page = 1;
    if(args[0] && isNaN(args[0])) return statusAccByService(message, args)
    if(args[0]) var page = args[0];
    //console.log(page);
    console.log("Here!4");
    var pagew = -1 + parseInt(page);
    var indexbypage = 21 * pagew;

    var sql1;
    let conn = await pool.getConnection();
    try {
        console.log("Here!5");
        const res = await conn.query(`SELECT atype, COUNT(*) FROM accounts GROUP BY atype`);
        sql1 = res;
        await conn.end();
    } catch (err) { throw err; }
    
    console.log("Here!6");
    console.log(sql1);

    var maxpages = Math.ceil(sql1.length / 21);

    if(page > maxpages) return message.reply(`Page **${page}** was not found! Pages available: **${maxpages}**`)

    let servicesembed = new Discord.RichEmbed()
        .setTitle("FireGen - Accounts Status")
        .setColor("#09419b")
        .setTitle("Available services:")
    
   for (i = indexbypage++; i < sql1.length; i++) {
        //services += sql1[i].atype + "\n";?
        servicesembed.addField(`${sql1[i].atype}`, "Available: " + Object.values(sql1[i])[1], true);
        if(i == 20 || i == -1 + sql1.length)
        {
            servicesembed.addField(`** **`, `**Page: ${page}/${maxpages} | !!status <page>**`);
            break;  
        }
    }
    message.channel.send(servicesembed);
    /*message.reply("Use `!!gen` next time. but let me do it now for you!");
    return generateAcc(message, []);*/
}

async function generateAcc(message, args)
{    
    if(!message.guild) return;
    if(message.channel.id != dbconf.generate_channel.id)
    {
        //if(message.channel.name == "💬generate") return;
        let m = await message.channel.send(`You are only allowed to generate accounts in ${dbconf.generate_channel} channel!`);
        await message.delete().catch(console.error);
        return setTimeout(function (){
            m.delete();
        }, 5000);
    }
    if(!args[0])
    {
        let embed = new Discord.RichEmbed()
            .setTitle("FireGen - !!gen")
            .setColor("#09419b")
            .addField('How to use?', `Usage: **!!gen <service>**`, false)
            .addField('Want to see all available services???:', "Do **!!status** to see them and how many left!");
        return message.channel.send(embed);
    }

    var dl = await isDelayed(message);
    if(dl.delayed) return message.channel.send(`Hey ${message.author}, you have to wait **${dl.time / 1000} seconds** to generated account again!`);

    if(!await message.member.roles.find(x => x.id == dbconf.client_role.id)) return message.channel.send(`Hey ${message.author}, you seem to don't have permissions to use this command!`);

    let conn, sql1;
    try {
        conn = await pool.getConnection();
        const res = await conn.query(`SELECT * FROM accounts WHERE atype = '${args[0]}' ORDER BY RAND() LIMIT 1`);
        sql1 = res;
        await conn.end();
    } catch (err) { throw err; }
    
    
    //console.log(sql1);

    if(!sql1[0]) return message.react("❌") && message.channel.send({embed: {
        color: 0xff0000,
        fields: [{
            name: `${args[0].toLowerCase()} account was not found`,
            value: `Please **double check** the service in **${prefix}status**`
            }]
    }});//message.channel.send(`${message.author} seems like I can't generate \`${args[0]}\` accounts.\nPlease check list of available accounts at **${config.prefix}gen**`)

    var role = await message.member.roles.find(x => x.id == "507244452608344095");

    if(!role)
    {
        setInterval(removeDelay, dbconf.delayMS, message);
        delayedUsers.push({
            id: message.author.id,
            time: dbconf.delayMS
        }); 
        
    }
    else 
    {
        setInterval(removeDelay, 2000, message);
        delayedUsers.push({
            id: message.author.id,
            time: 2000
        }); 
    }

    message.react("✅");
    message.author.send({embed: {
        color: 0x09419b,
        fields: [{
            name: `Your ${sql1[0].atype} account:`,
            value:  sql1[0].adata
            }]
    }});

    //message.channel.send(`Done. ${message.author} your \`${args[0]}\` was generated and sent to you! `);
    //message.author.send(`Hey ${message.author} there is your \`${args[0]}\` account:\`\`\`${sql1[0].adata}\`\`\``).then().catch(error => message.channel.send(`Hmmm ${message.author} there was some issue while I was trying to send your account.\nPlese check if you can recive DMs from Server Members!\n\nDEBUG: \`\`\`${error}\`\`\``));
        
        
}

async function genCodes(message, args)
{
    if(!isStaff(message)) return;
    if(!args[0]) 
    {
        let m = await message.reply("❓ Select \`plan\` for the codes?\n\nType \`cancel\` to exit or wait 30 seconds!");
        
        var filter = m => m.author.id == message.author.id;
        let respond = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond.first().content.toLowerCase().startsWith("cancel"))
        {
            await m.delete().catch(console.error);
        }
        else gencodeing = respond.first().content.toLowerCase();        
    }
    else gencodeing = args[0].toLowerCase();

    let m2 = await message.reply(`❓ How many **codes** with \`${gencodeing}\` plan you want to generate?\n\nType \`cancel\` to exit or wait 30 seconds!`);

    var filter = m => m.author.id == message.author.id;
    let respond2 = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

    if(respond2.first().content.toLowerCase().startsWith("cancel"))
    {
        return await m2.delete().catch(console.error);
    }

    if(isNaN(respond2.first().content)) return message.reply(`**I was expecting \`number\``) && genCodes(message, [gencodeing]);

    var addedaccs = 0;
    var failedaccs = 0;
    let m = await message.reply(`📥 Generating **${parseInt(respond2.first().content)}** codes for **${gencodeing}**`);

    for(i = 0; i < parseInt(respond2.first().content); i++)
    {
        var code = `${genstr(4)}-${genstr(4)}-${genstr(4)}-${genstr(4)}`;

        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(`INSERT INTO codes (type, code, used) VALUES (?, ?, ?)`, [gencodeing, code, 'false']);
            if(res.affectedRows != 0) addedaccs++;
            else failedaccs++;

            await conn.end();
        } catch (err) { throw err; }
        
    }

    await m.edit(`✅ **Generated!**\n**${addedaccs}** successful`);
}

async function addAcc(message, args)
{
    if(!isStaff(message)) return;
    if(!args[0]) 
    {
        let m = await message.reply("❓ What type of accounts you want to add?\n\n\Type \`cancel\` to exit or wait 30 seconds!");
        
        var filter = m => m.author.id == message.author.id;
        let respond = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond.first().content.toLowerCase().startsWith("cancel"))
        {
            return m.delete().catch(console.error);
        }
        else nowadding = respond.first().content.toLowerCase();        
    }
    else nowadding = args[0].toLowerCase();

    //waiting to select adding type
    let m3 = await message.reply("❓ Select how do you want to add the accounts?\n\`file\` or \`message\` \n\n\Type \`cancel\` to exit or wait 30 seconds!");
        
    var filter = m => m.author.id == message.author.id;
    let respond3 = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

    var check = respond3.first().content.toLowerCase();

    if(check.toLowerCase().startsWith("cancel"))
    {
        nowadding = null;
        return m3.delete().catch(console.error);
    }
    if(check.startsWith("file")) return testCMD(message, []);

    //waiting for accs
    let m1 = await message.reply("❓ Send me accounts to add (seperated by \`newline\`)\n\n\Type \`cancel\` to exit or wait 60 seconds!");
        
    var filter = m => m.author.id == message.author.id;
    let respond1 = await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).catch(message.reply("Uploading canceled due to inctivity!"));

    var check = respond1.first().content;
    console.log(check);

    if(check.toLowerCase().startsWith("cancel"))
    {
        nowadding = null;
        return m1.delete().catch(console.error);
    }

    var accounts = respond1.first().content.split("\n");
    var addedaccs = 0;
    var failedaccs = 0;
    let m = await message.reply("📥 Uploading to the database...");

    for(i = 0; i < accounts.length; i++)
    {
        /*let res = await sql.run(`INSERT INTO accounts (atype, adata) VALUES ('${nowadding}','${accounts[i]}')`).catch(error => console.error(error.title));
        if(res.stmt.changes != 0) addedaccs++;
        else failedaccs++;
        console.log(addedaccs);
        console.log(failedaccs);*/
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(`INSERT INTO accounts (atype, adata) VALUES (?, ?)`, [nowadding, accounts[i]]);
            if(res.affectedRows != 0) addedaccs++;
            else failedaccs++;

            await conn.end();
        } catch (err) { throw err; }
        
    }

    await m.edit(`✅ **Uploaded!**\n**${addedaccs}** successful\n**${failedaccs}** failed`);

    let m2 = await message.reply("❓ Do you want to add more accounts? \n\nType \`Yes/No\` or wait 30 seconds to exit!");
        
    var filter = m => m.author.id == message.author.id;
    let respond2 = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

    if(respond2.first().content.toLowerCase().startsWith("yes")) return addAcc(message, []);
    else {
        respond2.first().react("✅");
        nowadding = null;
    }
}

async function deleteAcc(message, args)
{
    if(!isStaff(message)) return;
    if(!args[0]) 
    {
        let m = await message.reply("What type of accounts you want to delete?\n\n\Type \`cancel\` to exit or wait 30 seconds!");
        
        var filter = m => m.author.id == message.author.id;
        let respond = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond.first().content.toLowerCase().startsWith("cancel"))
        {
            return m.delete().catch(console.error);
        }
        else nowdeleting = respond.first().content.toLowerCase();        
    }
    else nowdeleting = args[0].toLowerCase();

    if(!args[1]) 
    {
        let m1 = await message.reply("How many accounts to be deleted (for all use \`all\`)\n\n\Type \`cancel\` to exit or wait 30 seconds!");
            
        var filter = m => m.author.id == message.author.id;
        let respond1 = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond1.first().content.toLowerCase().startsWith("cancel"))
        {
            nowadding = null;
            return m1.delete().catch(console.error);
        }
        var todelete = respond1.first().content.toLowerCase();
    }
    else todelete = args[1];

    if(todelete.startsWith('all'))
    {
        /*let res = await sql.run(`DELETE FROM accounts WHERE atype = '${nowdeleting}'`);
        message.reply(`${res.stmt.changes} \`${nowdeleting}\` was deleted from the DB!`);*/
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(`DELETE FROM accounts WHERE atype = '${nowdeleting}'`);
            message.reply(`${res.affectedRows} \`${nowdeleting}\` was deleted from the DB!`);
            
            await conn.end();
        } catch (err) { throw err; }
        
    }
    else
    {
        /*let res = await sql.run(`DELETE FROM accounts WHERE atype = '${nowdeleting}' ORDER BY RANDOM() LIMIT ${parseInt(todelete)}`);
        message.reply(`${res.stmt.changes} \`${nowdeleting}\` was deleted from the DB!`);*/
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(`DELETE FROM accounts WHERE atype = '${nowdeleting}' ORDER BY RANDOM() LIMIT ${parseInt(todelete)}`);
            message.reply(`${res.affectedRows} \`${nowdeleting}\` was deleted from the DB!`);
            
            await conn.end();
        } catch (err) { throw err; }
        
    }
}

async function addbyFile(message, args, m)
{
    let addedaccs2 = 0;
    let failedaccs2 = 0;

    var lr = new LineByLineReader(`../downloads/${message.author.id}.txt`);

    lr.on('error', function (err) {
        console.error(err)
    });

    lr.on('line', async function (line) {
        lr.pause();

        //console.log(line);
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(`INSERT INTO accounts (atype, adata) VALUES (?, ?)`, [nowadding, line]);
            //console.log(res);
            if(res.affectedRows != 0) addedaccs2++;
            else failedaccs2++;
            //console.log(addedaccs2 + " | " + failedaccs2);
            await conn.end();
        } catch (err) { throw err; }
        
        //console.log(addedaccs2 + " 2| " + failedaccs2);

        setTimeout(function () {
            lr.resume();
        }, 100);
    });

    lr.on('end', async function () {
        //console.log(addedaccs2 + " 3| " + failedaccs2);
        require('fs').unlink(`../downloads/${message.author.id}.txt`, (err) => {
            if (err) throw err;
        });

        await m.edit(`✅ **Uploaded!**\n**${addedaccs2}** successful\n**${failedaccs2}** failed`);

        await message.reply("❓ Do you want to add more accounts? \n\n\Type \`Yes/No\` or wait 30 seconds to exit!");
            
        var filter = m => m.author.id == message.author.id;
        let respond2 = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond2.first().content.toLowerCase().startsWith("yes")) return addAcc(message, []);
        else {
            respond2.first().react("✅");
            nowadding = null;
        }
    });
}

async function testCMD(message, args)
{   
    var attachment;
    if(message.attachments.first() == null)
    {
        let m = await message.reply("Send me the \`txt\` file! \n\n\Type \`cancel\` to exit or wait 30 seconds!");
        
        var filter = m => m.author.id == message.author.id;
        let respond = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] }).catch(error => console.error(error.title));

        if(respond.first().content.toLowerCase().startsWith("cancel"))
        {
            return m.delete().catch(console.error);
        }
        else attachment = await respond.first().attachments.first();  
    }
    else attachment = await message.attachments.first();

    var l = attachment.url.length;
    var lastChar = attachment.url.substring(l-3, l); 
    if (lastChar != "txt") { 
        return message.reply("I was expecting \`txt\` file.\nLets do it again...") && testCMD(message, args);
    }

    var download = await wget.download(attachment.url, `../downloads/${message.author.id}.txt`);
    let m = await message.reply("📥**Uploading to the database...**");
    download.on('error', function(err) {
        console.log(err);
    });
    download.on('end', function(output) {
        console.log(output);
    });
    download.on('progress', async function(progress) {
        if(progress == 1) return setTimeout(addbyFile, 3000 ,message, args, m);
    });
}

async function activatePlan(message, args)
{
    if(!args[0]) return message.channel.send(`Hey ${message.author} you have code for plan? Activated it by doing \`${config.prefix}activate <code>\``)

    //Verify that code exists
    var res;
    let conn; 
    try {
        conn = await pool.getConnection();
        res = await conn.query(`SELECT * FROM codes WHERE code = '${args[0]}' AND used = 'false'`);
        await conn.end();
    } catch (err) { throw err; }
    
    //console.log(res[0]);
    if(!res[0]) return message.channel.send(`**Hmmmm** ${message.author} I was **unable** to activate this code, it can be **already activated** or you **typed it wrong**, please **double check** your code and try again!`);
    
    //Get the plan of the verified code
    var plan;
    let conn2 
    try {
        conn2 = await pool.getConnection();
        plan = await conn2.query(`SELECT * FROM plans WHERE type = '${res[0].type}'`);
        await conn2.end();
    } catch (err) { throw err; }
    
    //console.log(plan[0]);

    if(message.guild) await message.delete();

    //Set code 'used' to `true` and 'usedBy' to `user ID`
    var res2;
    let conn3 
    try {
        conn3 = await pool.getConnection();
        res2 = await conn3.query(`UPDATE codes SET used = 'true', usedBy = '${message.author.id}' WHERE id = '${res[0].id}'`);
        await conn3.end();
    } catch (err) { throw err; }
    
    //console.log(res2);

    let expire = {
        lifetime: null,
        number: null,
        unit: null
    }

    if(plan[0].type === "lifetime") expire.lifetime = true;
    else
    {
        expire.number = plan[0].expire.split(" ")[0];
        expire.unit = plan[0].expire.split(" ")[1];
    }

    await message.member.addRole(dbconf.client_role.id).catch(console.error);
    await message.member.addRole(plan[0].roleID).catch(console.error);
    //console.log(addroles);

    var res3;
    let conn4;
    try {
        conn4 = await pool.getConnection();
        res3 = await conn4.query(`SELECT * FROM users WHERE userID = ${message.author.id}`);
        await conn4.end();
    } catch (err) { throw err; }
    

    console.log(res3);
    if(res3[0])
    {
        var newdate = moment(res3[0].expire).add(expire.number, expire.unit);
        console.log(newdate);

        var newdate2 = newdate.toDate();
        console.log(newdate2);
        console.log(res3[0].expire);

        console.log(moment(res3[0].expire).add(expire.unit, expire.number));
        message.channel.send(`Hey ${message.author} you extended your plan with **${plan[0].expire}** .\nFor more information check your DM\n**Happy Generation!**`).catch(console.error);
        if(!expire.lifetime) message.author.send(`Your code **${args[0]}** was \`activated\` and you extended your plan with **${plan[0].expire}**\nYour plan will now expire: \`${newdate.format('LLL')}\``).catch(console.error);
        else message.author.send(`Your code **${args[0]}** was \`activated\` and you received **${plan[0].name}**`).catch(console.error);

        let conn5;
        try {                
            conn5 = await pool.getConnection();
            await conn5.query(`DELETE FROM users WHERE id = '${res3[0].id}'`)
           
            if(plan[0].type != "lifetime")
                await conn5.query(`INSERT INTO users (id, userID, plan, expire, code) VALUES (?, ?, ?, ?, ?)`, [res3[0].id,message.author.id, res3[0].plan + " + " + plan[0].type, moment(res3[0].expire).add(expire.number, expire.unit).toDate(), res3[0].code + " | " +args[0]]);
            else 
                await conn5.query(`INSERT INTO users (id, userID, plan, expire, lifetime,code) VALUES (?, ?, ?, ?, ?, ?)`, [res3[0].id,message.author.id, res3[0].plan + " + " + plan[0].type, moment("9999-12-30").toDate(), "true",res3[0].code + " | " +args[0]]);
            
            await conn5.end();
        } catch (err) { throw err; }
        
    }
    else
    {
        message.channel.send(`Hey ${message.author} you activated your plan and now you can **generate some fresh accounts**.\nFor more information check your DM\n**Happy Generation!**`).catch(console.error);
        if(!expire.lifetime) message.author.send(`Your code **${args[0]}** was \`activated\` and you received **${plan[0].name}**\nYour plan will expire: \`${moment().add(expire.number, expire.unit).format('LLL')}\``).catch(console.error);
        else message.author.send(`Your code **${args[0]}** was \`activated\` and you received **${plan[0].name}**`).catch(console.error);
    
        let conn5;
        try {
            conn5 = await pool.getConnection();
            if(plan[0].type != "lifetime")
                await conn5.query(`INSERT INTO users (userID, plan, expire, code) VALUES (?, ?, ?, ?)`, [message.author.id, plan[0].type, moment().add(expire.number, expire.unit).toDate(), args[0]]);
            else 
                await conn5.query(`INSERT INTO users (userID, plan, expire, lifetime,code) VALUES (?, ?, ?, ?, ?)`, [message.author.id, plan[0].type, moment("9999-12-30").toDate(), "true",args[0]]);
            
            await conn5.end();
        } catch (err) { throw err; }
        
    }
    
}

async function codesCMD(message, args)
{
    if(!isStaff(messge)) return;
	var page = args[0] ? parseInt(args[0]) : 1;
	var pagew = -1 + parseInt(page);
	var indexbypage = 20 * pagew;

	var sql1;
	let conn;
	try {
        conn = await pool.getConnection();
	    const res = await conn.query(`SELECT * FROM codes`);
	    sql1 = res;
	    await conn.end();
    } catch (err) { throw err; }
    

	console.log(sql1);

	var maxpages = Math.ceil(sql1.length / 20);

	if(page > maxpages) return message.reply(`Page **${page}** was not found! Pages available: **${maxpages}**`)

    var codes = [];
    codes.push(['ID', 'Plan', 'Code', "Used", "UsedBy"]);
    for (i = indexbypage; i < sql1.length; i++) 
    {
        codes.push(Object.values(sql1[i]));

	    if(i == indexbypage + 19 || i == -1 + sql1.length)
	    {	
            var res = table(codes);
            message.channel.send(`**All codes available: **\`\`\`${res}\`\`\`**Page: ${page}/${maxpages} | :codes <page>**`);
	        break;  
        }
    }
}

async function usersCMD(message, args)
{
    if(!isStaff(message)) return;
    var page = args[0] ? parseInt(args[0]) : 1;
	var pagew = -1 + parseInt(page);
	var indexbypage = 20 * pagew;

	var sql1;
	let conn;
	try {
        conn = await pool.getConnection();
	    const res = await conn.query(`SELECT * FROM users`);
	    sql1 = res;
	    await conn.end();
    } catch (err) { throw err; }
    

	console.log(sql1);

	var maxpages = Math.ceil(sql1.length / 20);

	if(page > maxpages) return message.reply(`Page **${page}** was not found! Pages available: **${maxpages}**`)

    var codes = [];
    codes.push(['ID', 'userID', 'Plan', "Expire", "Lifetime", "Codes"]);
    for (i = indexbypage; i < sql1.length; i++) 
    {
        codes.push(Object.values(sql1[i]));

	    if(i == indexbypage + 19 || i == -1 + sql1.length)
	    {	
            var res = table(codes);
            message.channel.send(`**All users available: **\`\`\`${res}\`\`\`**Page: ${page}/${maxpages} | :users <page>**`);
	        break;  
        }    
    }
}

async function userInfo(message, args)
{
    if (message.mentions.users.first()) {
        user = message.mentions.users.first();
    } else {
        user = message.author;
        }
    
      var allUsersJoinedAt = await getAllUsersJoinedAt(message);
      //console.log(allUsersJoinedAt);
      allUsersJoinedAt.sort(function(a,b) {
        return a.joinedAt - b.joinedAt;
      });
      var joinedPos = 1;
      for(i = 0; i < allUsersJoinedAt.length; i++)
      {
        //console.log(allUsersJoinedAt[i].username);
        if(allUsersJoinedAt[i].id == user.id)
        {
          joinedPos += i;
          break;
        }
      }

      var res = await getFormatedData(user);

      const status = client.emojis.find(x => x.name == user.presence.status);
      const member = message.guild.member(user);
      const embed = new Discord.RichEmbed()
        .setTitle(`${user.username}#${user.discriminator} ${status}`)
        .setColor("#09419b")
        .setThumbnail(user.avatarURL)
        .setTimestamp()
        .setFooter("FireGen - User Info", client.avatarURL)
        .addField("Registered:", `${moment(user.createdAt).format("LLL")}` , true)
        .addField("Joined:", `${moment(member.joinedAt).format("LLL")} (** ${joinedPos}**)` , true)
        .addField("Roles:", member.roles.map(roles => roles).join(`, `), true)     
        .addBlankField();
        console.log(res);
        if(res[0])
        {
           embed.addField("Plan:", `${res[0].plan}`, true);
           embed.addField("Expire:", res[0].lifetime ? "Never" : res[0].expire, true);

        }
        else 
        {
           embed.addField("Plan:", "Not available!"); 
        }
        message.channel.send({embed});
}

async function debugCMD(message, args)
{
    console.log(dbconf);
}

client.on("ready", async () => {
    console.log(`I'm alive!`);
    await reloadConfig();
    await checkCustomers();
    client.user.setActivity(`with the Fire🔥`, { type: 'PLAYING' });
});

client.on("message", async message => {   
    if(message.author.bot) return;

    //console.log(message.content.startsWith(config.staffprefix));
    if(message.content.startsWith(prefix))
    {
        //console.log("Working for !");
        const args = message.content.substring(prefix.length).split(" ");
        const command = args.shift().toLowerCase();
        customerCommands(message, command, args);
    }
    else if(message.content.startsWith(config.staffprefix))
    {
        //console.log("Working for " + config.staffprefix);
        const args = message.content.substring(config.staffprefix.length).split(" ");
        const command = args.shift().toLowerCase();
        staffCommands(message, command, args);
    }
    else return;
});

client.on("guildMemberUpdate", async (newguild, oldguild) => {   
    checkCustomers();
});

function customerCommands(message, command, args)
{
    console.log(command);
    console.log(args);
    switch (command)
    {
        case "ping":
            return ping(message);

        case "gen":
            return generateAcc(message, args);

        case "status":
            return statusAcc(message, args);    

        case "activate":
            return activatePlan(message, args);

        case "user":
            return userInfo(message, args);
    }
}

function staffCommands(message, command, args)
{
    console.log(command);
    console.log(args);
    switch (command)
    {
        case "reload":
            return reloadConfig(message, args);
            
        case "add":
            return addAcc(message, args);

        case "delete":
            return deleteAcc(message, args); 

        case "codes":
            return codesCMD(message, args);
        
        case "users":
            return usersCMD(message, args);

        case "gen":
            return genCodes(message, args);

        case "debug":
            return debugCMD(message, args);
    }
}

client.login(config.token);
