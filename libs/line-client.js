const axios = require("axios");
const qs = require("qs");

class Line {
  constructor(token) {
    this.token = token;
  }

  sendMessage = (message) => {
    var data = qs.stringify({
      message: message,
    });

    const config = {
      method: "post",
      url: "https://notify-api.line.me/api/notify",
      headers: {
        Authorization: "Bearer " + this.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: data,
    };

    axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  //   retrieve array of ticker
  formatNsendMessage = (ticker_data) => {
    let message = "";
    message = new Date().toLocaleTimeString() + "\n";
    ticker_data.forEach((v) => {
      let side = v[1] == "B" ? "ซื้อ" : "ขาย";
      let s =
        side +
        " " +
        v[0] +
        " ราคา " +
        v[3] +
        " มูลค่า " +
        v[4].toLocaleString() +
        // format with comma 1000 -> 1,000
        " บาท " +
        "คิดเป็น " +
        v[5] +
        " % ของวัน\n";
      message = message.concat(s);
    });

    this.sendMessage(message);
  };
}

module.exports = {
  Line: Line,
};
