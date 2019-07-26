const Discord = require('discord.js');
const client = new Discord.Client();
const randomInt = require('random-int');
const ms = require('pretty-ms');

var mineflayer = require('mineflayer');
const navigatePlugin = require('mineflayer-navigate')(mineflayer);

var bot = null;
var entityFollow = null;

const prefix = ":";

var devID = "204673020822945793";

function clean(text) {
  if (typeof(text) === "string")
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  else
      return text;
}

//Commands Functions

async function ping(message)
{
  message.delete().catch(console.error);
  const m = await message.channel.send("Ping?");
  m.edit(`**Pong!** VPS Latency is **${m.createdTimestamp - message.createdTimestamp}ms**. and Discord.JS API Latency is **${Math.round(client.ping)}ms**`);
}

async function join(message)
{
  if(bot) return message.reply("I'm already in the server! o_0");

  bot = mineflayer.createBot({
    host: "tosdev.ga", // optional
    username: "sidbutts@ymail.com", // email and password are required only for
    password: "201835",          // online-mode=true servers
  });

  navigatePlugin(bot);

  bot.navigate.on('pathFound', function (path) {
      bot.chat(`[INFO] I will be there in ${path.length} moves!`);
  });
  bot.navigate.on('cannotFind', function (closestPath) {
      bot.chat(`[INFO] Seems like its unreachable, getting to close I can.`);
      bot.navigate.walk(closestPath);
  });
  bot.navigate.on('arrived', function () {
      bot.chat("[INFO] I'm there!");
  });
  bot.navigate.on('interrupted', function() {
      bot.chat("[INFO] Something stopped me!");
  });
  bot.on('chat', function(username, message) {
    if (username === bot.username) return;

    const target = bot.players[username].entity;

    if (message === 'come') {
        bot.chat(`[INFO] Calculating path!`);
        console.log(target.position);
        bot.navigate.to(target.position);
    } else if (message === 'stop') {
        bot.navigate.stop();
    }
  });
}

async function leave(message)
{
  if(!bot) return message.reply("I'm have to be in the server to leave! o_0");
  bot.quit();
  bot = null;
}

client.on('ready', () => {
  console.log('I am ready!');
  client.user.setActivity('Minecraft', { type: 'PLAYING' });
});

client.on('message', message => {

  if (message.author.bot) return;

  if (!message.content.startsWith(prefix)) return;
  var args = message.content.substring(prefix.length).split(" ");

  switch (args[0].toLowerCase())
  {
    case "ping":
      return ping(message);

    case "join":
      return join(message);

    case "leave":
      return leave(message);

    case "eval":
      if(message.author.id !== devID) return;
      try
      {
        args.shift();
        var code = args.join(" ");
        var evaled = eval(code);
        if(typeof evaled !== "string") evaled = require("util").inspect(evaled);

        message.channel.send(`**INPUT** \`\`\`js\n${clean(code)}\n\`\`\``);
        if(clean(evaled).length > 1999 ) 
        {
          message.channel.send(`**OUTPUT** \`\`\`js\nOutput is too big for Discord (Check console for output)\n\`\`\``);
          console.log(clean(evaled));
        }
        else message.channel.send(`**OUTPUT** \`\`\`js\n${clean(evaled)}\n\`\`\``);
      } catch(err)
      {
        message.channel.send(`**INPUT** \`\`\`js\n${clean(code)}\n\`\`\``);
        message.channel.send(`**ERROR** \`\`\`js\n${clean(err)}\n\`\`\``);
      }
    break;

    default:
      return message.channel.send(":exclamation: Hmm It seems like you are lost, use **"+ prefix +"help** to help yourself.")
  }
});

client.login('NDczMDI1NjM4NDM4MTQxOTYy.Dj7-lA.LEBisxEZD_1YzII5YDV7JHfhBYA');
