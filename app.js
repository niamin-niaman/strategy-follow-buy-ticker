// Standard Library
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");

// Local Library
const { Streaming } = require("../streaming-wrapper-using-puppeteer/src/index");
const { Line } = require("./libs/line-client");
const { Portfolio } = require("./libs/portfolio");
const { helper } = require("./helper");
// Credential
const env = dotenv.config().parsed;
const BROKER = env.BROKER;
const USER_NAME = env.USER_NAME;
const PASSWORD = env.PASSWORD;
const line = new Line("3b0L3pLfrq9tdS0Oq2e9w9cTXNBfaYEtJjJZbm953k0");
const portfolio = new Portfolio(100000);

monitorTicker = (steaming, interval, callback) => {
  // let interval = 1000;

  let ticker_data_A = [];
  let ticker_data_B = [];
  let diff = [];

  // team A
  setTimeout(async () => {
    setInterval(async () => {
      ticker_data_A = await steaming.getTicker();
      diff = getDiff(ticker_data_B, ticker_data_A);
      // delete duplicate data
      // let stringArray = diff.map(JSON.stringify);
      // let uniqueStringArray = new Set(stringArray);
      // diff = Array.from(uniqueStringArray, JSON.parse);
      // display data
      // console.log(`[${new Date().toLocaleString()}] : A `);
      callback(diff);
    }, interval * 2);
  }, interval);

  // team  B
  setInterval(async () => {
    ticker_data_B = await steaming.getTicker();
    diff = getDiff(ticker_data_A, ticker_data_B);
    // delete duplicate data
    // let stringArray = diff.map(JSON.stringify);
    // let uniqueStringArray = new Set(stringArray);
    // diff = Array.from(uniqueStringArray, JSON.parse);
    // display data
    // console.log(`[${new Date().toLocaleString()}] : B `);
    callback(diff);
  }, interval * 2);
};

getTicker = (raw_ticker) => {
  // hepler function filter ticker has money morethan x
  costMoreThan = (array, price) => {
    // compute vol * price
    let raw_vol_x_price = array.map((v) => {
      let vol = parseFloat(v[2].replace(",", ""));
      let price = parseFloat(v[3]);
      // console.log(v[0], vol * price);
      return [v[0], v[1], v[2], v[3], vol * price];
    });

    // console.log(raw_vol_x_price);

    // filter value
    let raw_morethan_x = raw_vol_x_price.filter((v) => {
      return v[4] > price;
    });

    // console.log(raw_morethan_x);
    return raw_morethan_x;
  };

  // helper function check array empty ?
  isEmpty = (array) => {
    return Array.isArray(array) && (array.length == 0 || array.every(isEmpty));
  };

  // filter price less than 5
  let filtered_data = costMoreThan(raw_ticker, 1000000).filter(
    (v) => parseFloat(v[3]) < 5
  );

  if (!isEmpty(filtered_data)) {
    console.log(`[${new Date().toLocaleString()}]`);
    console.log(filtered_data);
    // Prepare message for sending
    let message = "";
    message = new Date().toLocaleTimeString() + "\n";
    filtered_data.forEach((v) => {
      let side = v[1] == "B" ? "ซื้อ" : "ขาย";
      let s =
        side +
        " " +
        v[0] +
        " ราคา " +
        v[3] +
        " มูลค่า " +
        v[4].toLocaleString() +
        " บาท \n";
      message = message.concat(s);
    });
    line.sendMessage(message);
    // console.log(message);
    message = "";

    let symbols_form_portfolio = portfolio.getPortfolio().map((v) => v.Symbol);
    // simulate sell / buy
    filtered_data.forEach((v) => {
      // buy if
      // - has ticker buy
      if (v[1] == "B") {
        // - has no in portfolio
        if(!symbols_form_portfolio.include(v[0])){
          // action buy
          console.log('BUY : ',v[0],' : ',v[3]);
        }
      }
      // sell if
      // - has ticker sell
      if (v[1] == "S") {
        // - has in portfolio
        if(symbols_form_portfolio.include(v[0])){
          // action sell
          console.log('SELL : ',v[0],' : ',v[3]);
        }
      }
    });

    TICKER.push(...filtered_data);
  }
};

let TICKER = [];
const rankingTicker = () => {
  let sell_ticker = TICKER.filter((v) => v[1] == "S");
  let buy_ticker = TICKER.filter((v) => v[1] == "B");

  let sort_sell_ticker = sell_ticker.sort(function (a, b) {
    return b[4] - a[4];
  });
  let sort_buy_ticker = buy_ticker.sort(function (a, b) {
    return b[4] - a[4];
  });

  let message = "";
  console.log("--- SELL ---");
  console.log(sort_sell_ticker);
  // sen message to buy
  message =
    new Date().toLocaleTimeString() + "\nอันดับ Ticker ที่มีการขายมากที่สุด\n";
  sort_sell_ticker.slice(0, 4).forEach((v) => {
    let s = "" + v[0] + " มูลค่า " + v[4].toLocaleString() + " บาท \n";
    message = message.concat(s);
  });
  if (sort_sell_ticker.length != 0) line.sendMessage(message);
  // console.log(message);
  message = "";

  console.log("--- BUY ---");
  console.log(sort_buy_ticker);

  // sen message to buy
  message =
    new Date().toLocaleTimeString() + "\nอันดับ Ticker ที่มีการซื้อมากที่สุด\n";
  sort_buy_ticker.slice(0, 4).forEach((v) => {
    let s = "" + v[0] + " มูลค่า " + v[4].toLocaleString() + " บาท \n";
    message = message.concat(s);
  });
  if (sort_buy_ticker.length != 0) line.sendMessage(message);
  // console.log(message);
  message = "";

  // reset global ticker
  TICKER = [];
};

const updateMarketsPrice = async (streaming, portfolio) => {
  while (true) {
    let symbols = portfolio.getPortfolio().map((v) => v.Symbol);
    for (let index = 0; index < symbols.length; index++) {
      const element = symbols[index];
      console.log(element);
      let [price, bid_offer] = await streaming.getQuote(element, 1);
      console.log(price, bid_offer);
      portfolio.updateMktPrice(element, price);
    }
  }
};

async function main() {
  const headless = false;
  const browser = await puppeteer.launch({
    headless: headless,
    defaultViewport: null,
  });

  const streaming = await new Streaming(browser, BROKER, USER_NAME, PASSWORD);
  // await streaming.newPage()

  monitorTicker(streaming, 2000, getTicker);

  // setInterval(() => {
  //   rankingTicker();
  // }, 30000);
}

async function expirement() {
  // INTERVALTIME
  // setTimeout(() => {
  //     // console.log('timeout');
  //     setInterval(() => {
  //         console.log('A', new Date());
  //     }, 2000);
  // }, 1000);

  // setInterval(() => {
  //     console.log('B', new Date());
  // }, 2000);

  // FIND DIFF
  // let Ticker_A = [
  //     [1],
  //     [2]
  // ]

  // let Ticker_B = [

  //     [2],
  //     [3]
  // ]
  // console.log('DIFF A , B');
  // console.log(getDiff(Ticker_A, Ticker_B));
  // console.log('DIFF B , A');
  // console.log(getDiff(Ticker_B, Ticker_A));
  // let diff = [...getDiff(Ticker_A, Ticker_B), ...getDiff(Ticker_B, Ticker_A)]
  // console.log(diff);

  // SUM ARRAY OF ARRAY
  // let diff = [['JMT', 'S', '30,600', '46.75', '']]

  // compute vol * price
  // let raw_vol_x_price = diff.map((v) => {
  //     let vol = parseFloat(v[2].replace(',', ''))
  //     let price = parseFloat(v[3])
  //     // console.log(v[0], vol * price);
  //     return [v[0], v[1], vol * price]
  // })

  // console.log(raw_vol_x_price);

  // let raw_morethan_1000 = raw_vol_x_price.filter((v) => {
  //     return v[2] > 10000
  // })

  // console.log(raw_morethan_1000);

  // SEND LINE MESSAGE
  // const line = new Line('3b0L3pLfrq9tdS0Oq2e9w9cTXNBfaYEtJjJZbm953k0');
  // line.sendMessage('a\na')

  // comma number

  // let sort_buy_ticker = [
  //     ['PTG', 'B', 3526000],
  //     ['PLANB', 'B', 1196790],
  //     ['PLANB', 'B', 1196790],
  //     ['PTT', 'B', 1006250]
  // ]

  // let message = 'อันดับ Ticker ที่มีการซื้อมากที่สุด\n'

  // sort_buy_ticker.forEach((v) => {
  //     let s = '' + v[0] + ' มูลค่า ' + v[2].toLocaleString() + '\n'
  //     message = message.concat(s)
  // })

  // console.log(message)

  // let s = 'อันดับ Ticker ที่ซ์้อมากที่สุด\
  //  PTG มูลลค่า 3,526,000 บาท\
  //  PLANB มูลค่า 1,196,790 บาท '

  //  console.log(s);

  // UPDATE MARKETPRICE
  // const headless = false;
  // const browser = await puppeteer.launch({
  //   headless: headless,
  //   defaultViewport: null,
  // });

  // const streaming = await new Streaming(browser, BROKER, USER_NAME, PASSWORD);
  // await streaming.newPage();

  // Mock data
  // portfolio.buy("BANPU", 100, 11.3);
  // portfolio.buy("JAS", 100, 2.9);

  // updateMarketsPrice(streaming, portfolio, true);

  // let symbols = portfolio.getPortfolio().map((v) => v.Symbol)
  // for (let index = 0; index < symbols.length; index++) {
  //     const element = symbols[index];
  //     console.log(element);
  //     let [price, bid_offer] = await streaming.getQuote(element, 1)
  //     console.log(price, bid_offer);
  //     portfolio.updateMktPrice(element, price)

  // }

  let t_01 = [[], [], [], [], [], [], [], [], []];
  // at t_01
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // | | | | | | | | | |  | | | |
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_02 = [["A"], ["B"], ["C"], [], [], [], [], [], []];
  // at t_02
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C| | | | | | |  |A|B|C|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_03 = [["A"], ["B"], ["C"], ["D"], ["E"], ["F"], [], [], []];
  // at t_03
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C|D|E|F| | | |  |D|E|F|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_04 = [["A"], ["B"], ["C"], ["D"], ["E"], ["F"], ["G"], ["H"], ["I"]];
  // at t_04
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C|D|E|F|G|H|I|  |G|H|I|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_05 = [["J"], ["K"], ["L"], ["D"], ["E"], ["F"], ["G"], ["H"], ["I"]];
  // at t_05
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |J|K|L|D|E|F|G|H|I|  |J|K|L|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_06 = [["J"], ["K"], ["L"], ["M"], ["N"], ["O"], ["G"], ["H"], ["I"]];
  // let t_06 = [["J","a","b","c","d"], ["K","a","b","c","d"], ["L","a","b","c","d"], ["M","a","b","c","d"], ["N","a","b","c","d"], ["O","a","b","c","d"], ["G","a","b","c","d"], ["H","a","b","c","d"], ["I","a","b","c","d"]];
  // at t_06
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |J|K|L|M|N|O|G|H|I|  |M|N|O|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  let t_07 = [["S"], ["T"], ["L"], ["M"], ["N"], ["O"], ["P"], ["Q"], ["R"]];
  // let t_07 = [["S","a","b","c","d"], ["T","a","b","c","d"], ["L","a","b","c","d"], ["M","a","b","c","d"], ["N","a","b","c","d"], ["O","a","b","c","d"], ["P","a","b","c","d"], ["Q","a","b","c","d"], ["R","a","b","c","d"]];
  // at t_07
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+
  // |S|T|L|M|N|O|P|Q|R|  |P|Q|R|S|T|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+

  // console.log(getDiff(t_01, t_02));
  // console.log(getDiff(t_02, t_03));
  // console.log(getDiff(t_03, t_04));
  // console.log(getDiff(t_04, t_05));
  // console.log(getDiff(t_05, t_06));
  console.log(helper.getDiff(t_06, t_07));
  // console.log('---');
  // console.log(getDiff(t_02, t_01));
  // console.log(getDiff(t_03, t_02));
  // console.log(getDiff(t_04, t_03));
  // console.log(getDiff(t_05, t_04));
  // console.log(getDiff(t_06, t_05));
  // console.log(getDiff(t_07, t_06));

  // setTimeout(() => {
  //   console.log("turn off");
  // updateMarketsPrice(streaming, portfolio, false)
  // }, 10000);
  // console.log(portfolio.getPortfolio());
}

if (require.main === module) {
  // main();
  expirement();
}
