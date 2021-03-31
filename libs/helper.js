const helper = {};

// helper function find differenc
// เอา array 2 ไม่เอา array 1
// take item which not contain in array 1
// array2 - array1
helper.getDiff = (array1, array2) => {
  function getKey(array) {
    return [0, 1, 2, 3, 4]
      .map(function (i) {
        // console.log(array);
        // console.log("i : ", i);
        // console.log("array[i] : ", array[i]);
        return array[i];
      })
      .join("|");
  }

  let hash = Object.create(null);
  let result = [];

  array1.forEach(function (a) {
    let key = getKey(a);
    hash[key] = true;
    // console.log(key);
  });
  // console.log(JSON.parse(JSON.stringify(hash)));

  result = array2.filter(function (a) {
    let key = getKey(a);
    // console.log(key);
    // console.log(hash[key]);
    return !hash[key];
  });
  return result;
};

// helper function convert toFixed return float
// https://stackoverflow.com/a/29494612/13080067
helper.toFixedNumber = (num, digits, base) => {
  var pow = Math.pow(base || 10, digits);
  return Math.round(num * pow) / pow;
};

// helper function check array of array empty ?
helper.isEmpty = (array) => {
  return (
    Array.isArray(array) && (array.length == 0 || array.every(helper.isEmpty))
  );
};

if (require.main === module) {
  const s = [["s"], ["a"]];
  console.log(!helper.isEmpty(s));
}
module.exports = {
  helper: helper,
};
