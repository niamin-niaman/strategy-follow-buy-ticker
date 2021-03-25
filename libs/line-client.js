const axios = require('axios');
const qs = require('qs');


class Line {
    constructor(token) {
        this.token = token
    }

    sendMessage = (message) => {

        var data = qs.stringify({
            'message': message
        });

        const config = {
            method: 'post',
            url: 'https://notify-api.line.me/api/notify',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        axios(config)
            .then(function (response) {
                console.log(JSON.stringify(response.data));
            })
            .catch(function (error) {
                console.log(error);
            });
    }

}

module.exports = {
    Line: Line
}