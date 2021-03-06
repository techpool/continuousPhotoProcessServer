var redis = require("redis"),
    qs = require('querystring'),
    request = require('request'),
    async = require('async'),
    colors = require('colors'),
    subscriberClient = redis.createClient({
        host: 'redis-13032.c10.us-east-1-4.ec2.cloud.redislabs.com',
        port: 13032,
        password: 'passme@123'
    });


const COMPUTER_VISION_KEY = '8bc2ed58753d4f09ba7ee07ce1b9303e';
const EMOTION_DETECTION_KEY = 'cb542a96122f45bdb9e74cfaeba96f81';
const REST_DB_APIKEY = '85d572967adac78254a7f9cb0b42003caaf3b';
const REST_DB_URL = 'https://alexaskill-c6ca.restdb.io/rest/';

/**
 * Handles error event with Redis
 */
subscriberClient.on("error", function(err) {
    console.log("Error " + err);
});

/**
 * Handles message event, which is whenever messages are triggered on any channels
 */
subscriberClient.on("message", function(channel, message) {

    switch (channel) {
        case 'visionapichannel':
            processWithVisionApi(JSON.parse(message));
            break;
        case 'emotionapichannel':
            processWithEmotionApi(JSON.parse(message));
            break;
        default:
            console.log('Doesnt match any of the channels')

    }
    console.log("sub channel " + channel + ": " + message);
});

subscriberClient.subscribe("visionapichannel");
subscriberClient.subscribe("emotionapichannel");


/**
 * Function to parse the image using the microsoft 
 * vision api and save the information in the rest db
 * @param  {Object} message Message object recieved from the 
 */
function processWithVisionApi(message) {

    console.log(message)
    if (!message.url) {
        return;
    }

    async.waterfall([

        /**
         * Fetches the data from the Microsoft Azure Service
         * @param  {Function} callback Waterfall Callback Function
         */
        function(callback) {
            var imageUrl = message.url;
            var query = {
                'visualFeatures': 'Tags,Description',
                'language': 'en'
            }

            var requestOptions = {
                'uri': 'https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?' + qs.stringify(query),
                'method': 'POST',
                'headers': {
                    'Ocp-Apim-Subscription-Key': COMPUTER_VISION_KEY,
                    'Content-Type': 'application/json'
                },
                'json': {
                    "url": message.url
                }
            }

            request(requestOptions, function(error, response, body) {

                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------AZURE RESPONSE-------------'.grey)
                console.log(JSON.stringify(body).green);
                console.log('------------AZURE RESPONSE-------------'.grey)

                var responseText = 'I think it is ';
                responseText += body.description.captions[0].text;
                responseText += '. The keywords are '
                for (var i = 0; i < body.tags.length; i++) {
                    var eachTag = body.tags[i];
                    responseText += eachTag.name + ', ';
                }
                console.log(responseText)
                callback(null, responseText);
            });
        },


        /**
         * Function to check whether a previous message is present in the database or not
         * @param  {String}   responseText Text response after parsing
         * @param  {Function} callback     Waterfall callback
         */
        function(responseText, callback) {
            var requestOptions = {
                'uri': REST_DB_URL + 'visionapi',
                'method': 'GET',
                'headers': {
                    'cache-control': 'no-cache',
                    'x-apikey': REST_DB_APIKEY,
                    'Content-Type': 'application/json'
                },
                json: true
            }

            request(requestOptions, function(error, response, body) {
                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------REST DB RESPONSE-------------'.grey)
                console.log(JSON.stringify(body).green)
                console.log('------------REST DB RESPONSE-------------'.grey)

                if (body.length == 0) {
                    callback(null, 'POST', responseText, null);
                } else {
                    var messageId = body[0]._id;
                    callback(null, 'PUT', responseText, messageId);
                }
            });
        },

        /**
         * Function to POST/PUT at the rest db with the new message
         * @param  {String}   method       Desired operation on the database
         * @param  {String}   responseText Parsed message to be stored in the database
         * @param  {String}   messageId    Message ID if there exists a previous message
         * @param  {Function} callback     Waterfall callback
         */
        function(method, responseText, messageId, callback) {

            var requestUrl = REST_DB_URL + 'visionapi';
            if (method == 'PUT') {
                requestUrl += '/' + messageId;
            }

            var requestOptions = {
                'uri': requestUrl,
                'method': method,
                'headers': {
                    'cache-control': 'no-cache',
                    'x-apikey': REST_DB_APIKEY,
                    'Content-Type': 'application/json'
                },
                'body': {
                    "message": responseText
                },
                json: true
            }

            request(requestOptions, function(error, response, body) {
                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------REST DB RESPONSE AFTER SAVE-------------'.grey)
                console.log(JSON.stringify(body).green);
                console.log('------------REST DB RESPONSE AFTER SAVE-------------'.grey)

                callback(null);
            });
        }
    ], function(error) {
        if (error) {
            console.log('------------ERROR-------------'.grey)
            console.log(JSON.stringify(error).red);
            console.log('------------ERROR-------------'.grey)
        }
    })

}


function processWithEmotionApi(message) {
    if (!message.url) {
        return;
    }

    async.waterfall([

        /**
         * Fetches the data from the Microsoft Azure Service
         * @param  {Function} callback Waterfall Callback Function
         */
        function(callback) {

            var imageUrl = message.url;
            var query = {
                'visualFeatures': 'Tags,Description',
                'language': 'en'
            }

            var requestOptions = {
                'uri': 'https://westus.api.cognitive.microsoft.com/emotion/v1.0/recognize',
                'method': 'POST',
                'headers': {
                    'Ocp-Apim-Subscription-Key': EMOTION_DETECTION_KEY,
                    'Content-Type': 'application/json'
                },
                'json': {
                    "url": message.url
                }
            }

            request(requestOptions, function(error, response, body) {

                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------AZURE RESPONSE-------------'.grey)
                console.log(JSON.stringify(body).green);
                console.log('------------AZURE RESPONSE-------------'.grey)

                var responseText = 'The person is ';
                if (body.length == 0) {
                    responseText = 'No emotion detected'
                } else {

                    var scores = body[0].scores;
                    var emotion;
                    var max = 0;
                    for (var prop in scores) {
                        var eachScore = scores[prop]
                        if (max < eachScore) {
                            max = eachScore
                            emotion = prop
                        }
                    }
                    emotion = convertEmotion(emotion);
                    responseText += emotion

                }
                console.log(responseText)
                callback(null, responseText);
            });
        },


        /**
         * Function to check whether a previous message is present in the database or not
         * @param  {String}   responseText Text response after parsing
         * @param  {Function} callback     Waterfall callback
         */
        function(responseText, callback) {
            var requestOptions = {
                'uri': REST_DB_URL + 'emotionapi',
                'method': 'GET',
                'headers': {
                    'cache-control': 'no-cache',
                    'x-apikey': REST_DB_APIKEY,
                    'Content-Type': 'application/json'
                },
                json: true
            }

            request(requestOptions, function(error, response, body) {
                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------REST DB RESPONSE-------------'.grey)
                console.log(JSON.stringify(body).green)
                console.log('------------REST DB RESPONSE-------------'.grey)

                if (body.length == 0) {
                    callback(null, 'POST', responseText, null);
                } else {
                    var messageId = body[0]._id;
                    callback(null, 'PUT', responseText, messageId);
                }
            });
        },

        /**
         * Function to POST/PUT at the rest db with the new message
         * @param  {String}   method       Desired operation on the database
         * @param  {String}   responseText Parsed message to be stored in the database
         * @param  {String}   messageId    Message ID if there exists a previous message
         * @param  {Function} callback     Waterfall callback
         */
        function(method, responseText, messageId, callback) {

            var requestUrl = REST_DB_URL + 'emotionapi';
            if (method == 'PUT') {
                requestUrl += '/' + messageId;
            }

            var requestOptions = {
                'uri': requestUrl,
                'method': method,
                'headers': {
                    'cache-control': 'no-cache',
                    'x-apikey': REST_DB_APIKEY,
                    'Content-Type': 'application/json'
                },
                'body': {
                    "message": responseText
                },
                json: true
            }

            request(requestOptions, function(error, response, body) {
                if (error) {
                    callback(error);
                    return;
                }

                console.log('------------REST DB RESPONSE AFTER SAVE-------------'.grey)
                console.log(JSON.stringify(body).green);
                console.log('------------REST DB RESPONSE AFTER SAVE-------------'.grey)

                callback(null);
            });
        }
    ], function(error) {
        if (error) {
            console.log('------------ERROR-------------'.grey)
            console.log(JSON.stringify(error).red);
            console.log('------------ERROR-------------'.grey)
        }
    });
}


function convertEmotion(emotion) {
    switch (emotion) {
        case "happiness":
            return "happy"
        case "anger":
            return "angry"
        case "contempt":
            return "contemptful";
        case "disgust":
            return "disgustful"
        case "fear":
            return "scared"
        case "happiness":
            return "happy"
        case "neutral":
            return "neutral"
        case "sadness":
            return "sad"
        case "surprise":
            return "surprised"

    }
}
