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
  formatNsendMessage = (raw_ticker) => {
    let message = "";
    message = new Date().toLocaleTimeString() + "\n";
    let side =
      raw_ticker.side == "B" ? "ซื้อ" : raw_ticker.side == "S" ? "ขาย" : " - ";
    let s =
      side +
      " " +
      raw_ticker.symbol +
      " ราคา " +
      raw_ticker.price +
      " มูลค่า " +
      raw_ticker.cost.toLocaleString() +
      // format with comma 1000 -> 1,000
      " บาท " +
      "คิดเป็น " +
      raw_ticker.percent_volume +
      " % ของวัน\n";
    message = message.concat(s);
    this.sendMessage(message);
  };
}

module.exports = {
  Line: Line,
};
