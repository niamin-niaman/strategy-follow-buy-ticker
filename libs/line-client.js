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
  formatNsendMessage = (t) => {
    let message = "";
    message = t.time_stamp.toLocaleTimeString() + "\n";
    let side = t.side == "B" ? "ซื้อ" : t.side == "S" ? "ขาย" : " - ";
    // let s =
    //   side +
    //   " " +
    //   t.symbol +
    //   " ราคา " +
    //   t.price +
    //   " มูลค่า " +
    //   t.cost.toLocaleString() +
    //   // format with comma 1000 -> 1,000
    //   " บาท \n" +
    //   "คิดเป็น " +
    //   t.percent_day_volume +
    //   " % ของวัน "+
    //   "volume ทั้งเป็น \n";

    // prettier-ignore
    let s =
`${side} ${t.symbol} ราคา ${t.price} บาท มูลค่า ${t.cost.toLocaleString()} บาท
คิดเป็น ${t.percent_day_volume} % ของวัน volume ทั้งวันคิดเป็น ${t.percent_5d_avg_volume} % ของค่าเฉลี่ย 5 วัน 
ซื้อ ${t.percent_symbol_buy} % ขาย ${t.percent_symbol_sell} %`;

    message = message.concat(s);
    this.sendMessage(message);
  };
}

module.exports = {
  Line: Line,
};
