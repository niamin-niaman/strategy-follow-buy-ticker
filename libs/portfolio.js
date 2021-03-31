const fs = require("fs");
const { helper } = require("./helper");
class Portfolio {
  constructor(lineAvailable) {
    this.lineAvailable = lineAvailable;
    // default % stoploss 1 %
    this.percentStoploss = 0.01;
    this.portfolio = [];

    Object.defineProperty(this, "sum", {
      enumerable: true,
      get: function () {
        if (this.portfolio.length <= 1) {
          return {
            UnrealizedPL: this.portfolio[0].UnrealizedPL || 0,
            AmountCost: this.portfolio[0].AmountCost || 0,
            MarketValue: this.portfolio[0].MarketValue || 0,
            PercentUnrealizedPL: this.portfolio[0].PercentUnrealizedPL || 0,
          };
        }
        // https://stackoverflow.com/a/35480841/13080067
        let object = this.portfolio.reduce((preVal, curVal) => ({
          UnrealizedPL: preVal.UnrealizedPL + curVal.UnrealizedPL,
          AmountCost: preVal.AmountCost + curVal.AmountCost,
          MarketValue: preVal.MarketValue + curVal.MarketValue,
        }));

        object.PercentUnrealizedPL = parseFloat(
          ((object.UnrealizedPL / object.AmountCost) * 100).toFixed(2)
        );

        return object;
      },
    });
  }

  // import data
  // json file path
  importData(path) {
    const jsonString = fs.readFileSync(path);
    const rawData = JSON.parse(jsonString);
    // console.log(portfolio);
    // loop over and insert each item
    // insert new row
    rawData.portfolio.forEach((element) => {
      //   console.log(element);
      let s = new Symbol();
      s.Symbol = element.Symbol;
      s.ActualVol = element.ActualVol;
      s.AvgCost = element.AvgCost;
      this.portfolio.push(s);
      this.portfolio[
        this.portfolio.findIndex((x) => x.Symbol == element.Symbol)
      ].MktPrice = parseFloat(element.MktPrice);
    });

    this.lineAvailable = rawData.lineAvailable;
  }

  // export data
  // json file path
  exportData(path) {
    let rawData = {
      lineAvailable: this.lineAvailable,
      portfilio: this.getPortfolio(),
    };
    const jsonString = JSON.stringify(rawData);
    fs.writeFileSync(path, jsonString);
  }

  buy(symbol, vol, price) {
    // check amountCost > line available
    if (vol * price > this.lineAvailable) {
      // error
      console.log("Error : Amount Cost morethan Line available");
      return false;
    }

    // find in portfolio
    let i = this.portfolio.findIndex((x) => x.Symbol == symbol);
    if (i > -1) {
      // if found then increase vol & compute new avgCost
      // compute new avgCost
      // this.portfolio[i].AvgCost = parseFloat(((this.portfolio[i].AmountCost + (vol * price)) / (this.portfolio[i].ActualVol + vol)).toFixed(2))
      this.portfolio[i].AvgCost = parseFloat(
        (
          (this.portfolio[i].AmountCost + vol * price) /
          (this.portfolio[i].ActualVol + vol)
        ).toPrecision(2)
      );
      // increase vol
      this.portfolio[i].ActualVol += vol;
    } else {
      // not found then insert new one
      let s = new Symbol();
      s.Symbol = symbol;
      s.ActualVol = vol;
      s.AvgCost = price;
      // set stop loss
      s.stoploss = helper.toFixedNumber(price * (1 - this.percentStoploss), 2);
      this.portfolio.push(s);
    }

    // decrease line available
    this.lineAvailable -= price * vol;
    return true;
  }

  sell(symbol, vol, price) {
    // if not found in portfolio then
    let i = this.portfolio.findIndex((x) => x.Symbol == symbol);
    if (i < 0) {
      //  error
      console.log("Error : Not found symbol");
      return false;
    }

    // check vol morethan actualVol
    if (vol > this.portfolio[i].ActualVol) {
      // error
      console.log("Error : Volume morethan ActualVol");
      return false;
    }
    // decrease vol
    this.portfolio[i].ActualVol -= vol;

    // if sell all then remove from list
    if (this.portfolio[i].ActualVol == 0) this.portfolio.splice(i, 1);

    // increase line availabe
    this.lineAvailable += price * vol;
    return true;
  }

  updateMktPrice(symbol, price) {
    // https://stackoverflow.com/a/44048398/13080067
    const i = this.portfolio.findIndex((x) => x.Symbol == symbol);
    const MktPrice = parseFloat(price);
    this.portfolio[i].MktPrice = MktPrice;
    // then update stoploss
    // - check if new stoploss highter than older stop loss
    // - - then update new one
    if (MktPrice * (1 - this.percentStoploss) > this.portfolio[i].stoploss) {
      this.portfolio[i].stoploss = helper.toFixedNumber(
        MktPrice * (1 - this.percentStoploss),
        2
      );
    }
    return true;
  }

  getPortfolio() {
    // console.log(JSON.parse(JSON.stringify(this.portfolio)));
    return JSON.parse(JSON.stringify(this.portfolio));
    // return JSON.parse(JSON.stringify(this));
  }
}

// define each symbol in portfilio
class Symbol {
  constructor() {
    this.Symbol = "";
    this.ActualVol = 0;
    this.AvgCost = 0;
    this.MktPrice = 0;

    // https://www.marcusnoble.co.uk/2018-01-26-getters-and-setters-in-javascript/
    // https://stackoverflow.com/a/34517882/13080067
    // https://stackoverflow.com/a/29787627/13080067
    Object.defineProperty(this, "AmountCost", {
      enumerable: true,
      get: function () {
        return this.ActualVol * this.AvgCost;
      },
    });

    Object.defineProperty(this, "MarketValue", {
      enumerable: true,
      get: function () {
        return this.ActualVol * this.MktPrice;
      },
    });

    Object.defineProperty(this, "UnrealizedPL", {
      enumerable: true,
      get: function () {
        return this.MarketValue - this.AmountCost;
      },
    });

    Object.defineProperty(this, "PercentUnrealizedPL", {
      enumerable: true,
      get: function () {
        return parseFloat(
          (((this.MktPrice - this.AvgCost) / this.AvgCost) * 100).toFixed(2)
        );
      },
    });

    // add stoploss
    this.stoploss = 0;
  }
}

const main = async () => {
  // helper function

  const portfolio = new Portfolio(5000);

  console.log(portfolio.getPortfolio());

  portfolio.buy("AGE", 200, 1.89);
  portfolio.updateMktPrice("AGE", 2);
  //   portfolio.buy("AOT", 5, 60.1);
  //   portfolio.updateMktPrice("AOT", 67.25);
  //   portfolio.buy("INET", 100, 3.81);
  //   portfolio.updateMktPrice("INET", 4.18);
  //   portfolio.buy("NYT", 100, 3.53);
  //   portfolio.updateMktPrice("NYT", 4.0);
  //   portfolio.buy("SC", 100, 2.8);
  //   portfolio.updateMktPrice("SC", 3.08);
  //   console.log("Line available :", portfolio.lineAvailable);
  //   console.log(portfolio.getPortfolio());

  //   portfolio.exportData("./data/portfolio_A.json");
  // portfolio.importData("./data/portfolio_A.json");

  console.log(portfolio.getPortfolio());

  // let f = portfolio.getPortfolio().filter(v => v.PercentUnrealizedPL > 10)
  // console.log(f);
  // let l = portfolio.getPortfolio().map(v => v.Symbol)
  // console.log(l);
  // console.log(JSON.parse(JSON.stringify(portfolio.sum)));
};

if (require.main === module) {
  main();
}

module.exports = {
  Portfolio: Portfolio,
};
