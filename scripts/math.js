// Description:
//   Allows Hubot to do mathematics.
//
// Commands:
//   hubot math me <expression> - Calculate the given expression.
//   hubot convert me <expression> to <units> - Convert expression to given units.
module.exports = function(robot) {
  return robot.respond(/(calc|calculate|convert|math)( me)? (.*)/i, function(msg) {
    return msg.http('https://www.google.com/ig/calculator').query({
      hl: 'en',
      q: msg.match[3]
    }).headers({
      'Accept-Language': 'en-us,en;q=0.5',
      'Accept-Charset': 'utf-8',
      'User-Agent': "Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) Gecko/20100101 Firefox/4.0.1"
    }).get()(function(err, res, body) {
      let json = eval("(" + body + ")");
      return msg.send(json.rhs || 'Could not compute.');
    });
  });
};
