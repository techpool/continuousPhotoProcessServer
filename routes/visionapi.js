var express = require('express');
var router = express.Router();
var redis = require("redis"),
    publisherClient = redis.createClient({
        host: 'redis-13032.c10.us-east-1-4.ec2.cloud.redislabs.com',
        port: 13032,
        password: 'passme@123'
    });

/* GET home page. */
router.post('/process', function(req, res, next) {

    var url = req.body.url;
    publisherClient.publish("visionapichannel", JSON.stringify({
        url: url
    }));

    publisherClient.publish("emotionapichannel", JSON.stringify({
        url: url
    }));
    res.send('Hello from vision api')
});

module.exports = router;
