// Description:
//   Give or take away points. Keeps track and even prints out graphs.
//
// Dependencies:
//   "underscore": ">= 1.0.0"
//   "clark": "0.0.6"
//
// Configuration:
//
// Commands:
//   <name>++
//   <name>--
//   hubot score <name>
//   hubot top <amount>
//   hubot bottom <amount>
//   hubot scoreboard
//
// Author:
//   ajacksified

let _ = require("underscore")
let clark = require("clark").clark

class ScoreKeeper {
  constructor(robot) {
    this.robot = robot;
    this.cache = {
      scoreLog: {},
      scores: {}
    }

    this.robot.brain.on('loaded', () => {
      this.robot.brain.data.scores = this.robot.brain.data.scores || {};
      this.robot.brain.data.scoreLog = this.robot.brain.data.scoreLog || {};

      this.cache.scores = this.robot.brain.data.scores;
      this.cache.scoreLog = this.robot.brain.data.scoreLog;
    });
  }

  getUser(user) {
    this.cache.scores[user] = this.cache.scores[user] || 0;
    return user;
  }

  saveUser(user, from) {
    this.saveScoreLog(user, from);
    this.robot.brain.data.scores[user] = this.cache.scores[user];
    this.robot.brain.data.scoreLog[from] = this.cache.scoreLog[from];
    this.robot.brain.emit('save', this.robot.brain.data);
    return this.cache.scores[user];
  }

  findUserByMentionName(mentionName) {
    mentionName = mentionName.replace(/@/g, "");
    // Slack trailing colon filter
    if (mentionName[0] != ':' && mentionName[mentionName.length - 1] == ':') {
      mentionName = mentionName.slice(0, -1);
    }
    for (let user_jid in this.robot.brain.data.users) {
      let user = this.robot.brain.data.users[user_jid];
      if (user.mention_name == mentionName) {
        return user.name;
      }
    }
    return mentionName;
  }

  isUser(mentionName) {
    mentionName = mentionName.replace(/@/g, "");
    if (mentionName[0] != ':' && mentionName[mentionName.length - 1] == ':') {
      mentionName = mentionName.slice(0, -1);
    }
    let result = this.robot.brain.userForName(mentionName);
    return result != null;
  }

  findMentionNameByUser(user_name) {
    for (let user_jid in this.robot.brain.data.users) {
      let user = this.robot.brain.data.users[user_jid];
      if (user.name == user_name) {
        return user.mention_name;
      }
    }
    return "Could not find: #{user_name}.";
  }

  setMentionName(user_name, mention_name) {
    user = this.robot.brain.userForName(user_name);
    return this.robot.brain.data.users[user.id].mention_name = mention_name;
  }

  add(user, from) {
    if (this.validate(user, from)) {
      user = this.getUser(user);
      this.cache.scores[user]++;
      return this.saveUser(user, from);
    }
  }

  subtract(user, from) {
    if (this.validate(user, from)) {
      user = this.getUser(user);
      this.cache.scores[user]--;
      return this.saveUser(user, from);
    }
  }

  scoreForUser(user) {
    user = this.getUser(user);
    return this.cache.scores[user];
  }

  saveScoreLog(user, from) {
    if (!(typeof this.cache.scoreLog[from] == "object")) {
      this.cache.scoreLog[from] = {};
    }

    return this.cache.scoreLog[from][user] = new Date();
  }

  isSpam(user, from) {
    this.cache.scoreLog[from] = this.cache.scoreLog[from] || {};

    if (!this.cache.scoreLog[from][user]) {
      return false;
    }

    let dateSubmitted = this.cache.scoreLog[from][user];

    let date = new Date(dateSubmitted);
    let messageIsSpam = date.setSeconds(date.getSeconds() + 7200) > new Date();

    if (!messageIsSpam) {
      delete this.cache.scoreLog[from][user] //clean it up
    }

    return messageIsSpam;
  }

  validate(user, from) {
    return user != from && user != "" && !this.isSpam(user, from);
  }

  length() {
    return this.cache.scoreLog.length;
  }

  top(amount) {
    let tops = []

    for (let name in this.cache.scores) {
      let score = this.cache.scores[name];
      if (!(typeof score != "number")) {
        tops.push({"name": name, "score": score});
      }
    }

    return tops.sort((a,b) => b.score - a.score).slice(0,amount);
  }

  bottom(amount) {
    let all = this.top(this.cache.scores.length);
    return all.sort((a,b) => b.score - a.score).reverse().slice(0,amount);
  }
}

module.exports = function(robot) {
  let scoreKeeper = new ScoreKeeper(robot);

  robot.hear(/([\w\S]+)([\W\s]*)?(\+\+)(.*)$/i, function(msg) {
    let name = msg.match[1].trim();
    let from = msg.message.user.name;
    let real_name = scoreKeeper.findUserByMentionName(name);
    if (from === real_name) {
      msg.send("Don't be selfish, " + name + ".");
      return;
    }
    if (from === 'slackbot') {
      return;
    }
    let newScore = scoreKeeper.add(real_name, from);
    if (newScore != null) {
      return msg.send(real_name + " has " + newScore + " points.");
    }
  });

  robot.hear(/([\w\S]+)([\W\s]*)?(\-\-)(.*)$/i, function(msg) {
    let name = msg.match[1].trim();
    let from = msg.message.user.name;
    let real_name = scoreKeeper.findUserByMentionName(name);
    if (from === real_name) {
      msg.send("Why are you minus minusing yourself, " + name + "?");
      return;
    }
    if (scoreKeeper.isUser(name)) {
      msg.send("Bad!");
      let newScore = scoreKeeper.subtract(from, real_name);
      if (newScore != null) {
        return msg.send(from + " has " + newScore + " points.");
      }
    } else {
      let newScore = scoreKeeper.subtract(real_name, from);
      if (newScore != null) {
        return msg.send(real_name + " has " + newScore + " points.");
      }
    }
  });

  robot.respond(/score (for\s)?(.*)/i, function(msg) {
    let name = msg.match[2].trim().toLowerCase();
    let score = scoreKeeper.scoreForUser(name);
    return msg.send(name + " has " + score + " points.");
  });

  robot.respond(/(top|bottom) (\d+)/i, function(msg) {
    let amount = parseInt(msg.match[2]);
    let message = [];
    let tops = scoreKeeper[msg.match[1]](amount);
    for (let i = 0; i < tops.length; i++) {
      message.push((i + 1) + ". " + tops[i].name + " : " + tops[i].score);
    }
    return msg.send(message.join("\n"));
  });

  robot.respond(/scoreboard/i, function(msg) {
    let message = [];
    let tops = scoreKeeper['top'](scoreKeeper.cache.scores.length);
    for (let i = 0; i < tops.length; i++) {
      message.push((i + 1) + ". " + tops[i].name + " : " + tops[i].score);
    }
    return msg.send(message.join("\n"));
  });

  robot.respond(/mention name for (.*)$/i, function(msg) {
    let person = msg.match[1];
    return msg.send(scoreKeeper.findMentionNameByUser(person));
  });

  robot.respond(/set mention name for \s (.*)/i, function(msg) {
    let name = msg.match[2].trim();
    let mention_name = msg.match[3].trim();
    return scoreKeeper.setMentionName(name, mention_name);
  });
};
