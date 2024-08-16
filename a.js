var conf = require('./config/conf');
var TelegramBot = require('node-telegram-bot-api');
process.env.NODE_ENV='production'
console.log(process.env.NODE_ENV)//终端打印的就是production,app后面所有的代码都能通过process.env.NODE_ENV获取到当前的环境
process.stdin.setEncoding('utf8');

/* 创建实例对象开始 */
var bot = new TelegramBot(conf.token, { polling: true });
/* 创建实例对象结束 */

/* 监听新消息 */
bot.on('message', (msg) => {
  conf.pool.getConnection(function (err, connection) {
    if (err) throw err;
    connection.query('SELECT * FROM users WHERE telegramid = ?', [msg.from.id], (error, result) => {
      if (error) throw error;
      if (result.length == 0) {
        connection.query('INSERT INTO users (username, telegramid, name, register_time) VALUES (?, ?, ?, NOW())', [msg.from.username || '', msg.from.id, utf16toEntities((msg.from.first_name || '') + (msg.from.last_name || ''))], (error, result) => {
          connection.destroy();
          if (error) throw error;
          main(msg);
        });
      } else if (result[0].isban == 1 && msg.chat.type == 'private') {
        bot.sendMessage(msg.from.id, '<b>您已被拉黑，请您联系客服进行解除！</b>', {
          parse_mode: 'HTML'
        });
      } else {
        connection.query('UPDATE users SET username = ?, name = ? WHERE telegramid = ?', [msg.from.username || '', utf16toEntities((msg.from.first_name || '') + (msg.from.last_name || '')), msg.from.id], (error, result) => {
          connection.destroy();
          if (error) throw error;
          main(msg);
        });
      }
    });
  });
});

function main(msg) {
  if (msg.text) {
    if (msg.text == '/start') {
      bot.sendMessage(msg.from.id, '👏您好欢迎使用双向机器人，您可以发送您发送的消息等待客服回复！', {
        reply_markup: JSON.stringify({
          keyboard: [
            [{ text: '查询ID' }, { text: '🔰旗下业务' }, ],
            [{ text: '👤个人信息' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        })
      });
    }
    //按钮3
    if (msg.text == '👤个人信息') {
      bot.sendMessage(msg.from.id, '<b>👤您的个人信息：</b>\n\n<b>姓名： </b>' + msg.from.first_name+''+
      '<b>\n用户名： @</b>'+ msg.from.username +""+
      '<b>\n您的ID: </b>' + msg.from.id
      , {
        parse_mode: 'HTML'
      });
    }
    //按钮2
    if (msg.text == '🔰旗下业务') {
      bot.sendMessage(msg.from.id, '<b>以下是RS7旗下业务信息：\n\n🔸机器人定制 🔹飞机靓号出租.\n\n🔹USDT靓号地址  🔸24HTRX兑换.\n\n🔸快三娱乐大群  🔹扫雷娱乐大群.</b>'
    
      , {
        parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup:{
           inline_keyboard:[
          [{text:"RS7负责人",url:"https://t.me/RS7GW"} ,{text:"快三娱乐群",url:"https://t.me/RS7KS"}],
          [{text:"RS7业务群",url:"https://t.me/RS7VIP"} ],
           ]}
      });
    }
    //按钮1
    if (msg.text == '查询ID') {
      bot.sendMessage(msg.from.id, '<b>您的ID:</b>'+ msg.from.id,{
        parse_mode: 'HTML'
      });

    } else if (msg.text.startsWith('/send') && msg.chat.id == conf.adminid) {
      qunfa(msg);
    } else if (msg.chat.id != conf.adminid && msg.chat.type == 'private') {
      bot.forwardMessage(conf.adminid, msg.chat.id, msg.message_id, {
        disable_web_page_preview: true
      }).then(res => {
        conf.pool.getConnection(function (err, connection) {
          if (err) throw err;
          connection.query('INSERT INTO message (messageid, telegramid, time) VALUES (?, ?, NOW())', [res.message_id, msg.from.id], (error, result) => {
            connection.destroy();
            if (error) throw error;
          });
        });
      });
    } else if (msg.reply_to_message && msg.chat.id == conf.adminid) {
      conf.pool.getConnection(function (err, connection) {
        if (err) throw err;
        connection.query('SELECT * FROM message WHERE messageid = ?', [msg.reply_to_message.message_id], (error, result) => {
          connection.destroy();
          if (error) throw error;
          if (msg.text == '/ban') {
            conf.pool.getConnection(function (err, connection) {
              if (err) throw err;
              connection.query('UPDATE users SET isban = 1 WHERE telegramid = ?', [result[0].telegramid], (error, result) => {
                connection.destroy();
                if (error) throw error;
                bot.sendMessage(msg.chat.id, '<b>该用户已拉黑</b>', {
                  parse_mode: 'HTML'
                });
              });
            });
          } else if (msg.text == '/unban') {
            conf.pool.getConnection(function (err, connection) {
              if (err) throw err;
              connection.query('UPDATE users SET isban = 0 WHERE telegramid = ?', [result[0].telegramid], (error, result) => {
                connection.destroy();
                if (error) throw error;
                bot.sendMessage(msg.chat.id, '<b>该用户已解除拉黑</b>', {
                  parse_mode: 'HTML'
                });
              });
            });
          } else {
            bot.forwardMessage(result[0].telegramid, msg.chat.id, msg.message_id, {
              disable_web_page_preview: true
            });
          }
        });
      });
    }
  } else if (msg.reply_to_message && msg.chat.id == conf.adminid) {
    conf.pool.getConnection(function (err, connection) {
      if (err) throw err;
      connection.query('SELECT * FROM message WHERE messageid = ?', [msg.reply_to_message.message_id], (error, result) => {
        connection.destroy();
        if (error) throw error;
        bot.forwardMessage(result[0].telegramid, msg.chat.id, msg.message_id, {
          disable_web_page_preview: true
        });
      });
    });
  } else if (msg.chat.type == 'private') {
    bot.forwardMessage(conf.adminid, msg.chat.id, msg.message_id, {
      disable_web_page_preview: true
    }).then(res => {
      conf.pool.getConnection(function (err, connection) {
        if (err) throw err;
        connection.query('INSERT INTO message (messageid, telegramid, time) VALUES (?, ?, NOW())', [res.message_id, msg.from.id], (error, result) => {
          connection.destroy();
          if (error) throw error;
        });
      });
    });
  }
}

function qunfa(msg) {
  conf.pool.getConnection(function (err, connection) {
    if (err) return err;
    connection.query('SELECT * FROM users ORDER BY id', (error, result) => {
      if (error) return error;
      connection.destroy();
      var index = 0;
      var successful = 0;
      bot.sendMessage(msg.chat.id, '开始群发');
      var qunfa = setInterval(function () {
        if (result.length - 1 < index) {
          bot.sendMessage(msg.chat.id, '群发结束');
          clearInterval(qunfa);
        } else {
          bot.sendMessage(result[index].telegramid, msg.text.split("/send")[1], {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          })
            .then(res => {
              successful++;
              if (successful % 100 == 0) {
                bot.sendMessage(msg.chat.id, '已成功群发' + successful + '次');
              }
              index++;
            })
            .catch(res => {
              index++;
            });
        }
      }, 1000);
    });
  });
}

function utf16toEntities(str) {
  const patt = /[\ud800-\udbff][\udc00-\udfff]/g;
  str = str.replace(patt, (char) => {
    let H;
    let L;
    let code;
    let s;

    if (char.length === 2) {
      H = char.charCodeAt(0);
      L = char.charCodeAt(1);
      code = (H - 0xD800) * 0x400 + 0x10000 + L - 0xDC00;
      s = `&#${code};`;
    } else {
      s = char;
    }

    return s;
  });

  return str;
}
