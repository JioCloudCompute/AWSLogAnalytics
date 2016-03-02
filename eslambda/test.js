/*
 * Sample node.js code for AWS Lambda to get Apache log files from S3, parse
 * and add them to an Amazon Elasticsearch Service domain.
 *
 *
 * Copyright 2015- Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at http://aws.amazon.com/asl/
 * or in the "license" file accompanying this file.  This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * express or implied.  See the License for the specific language governing
 * permissions and limitations under the License.
 */

/* Imports */
var AWS = require('aws-sdk');
var LineStream = require('byline').LineStream;
//var parse = require('syslog-parse');  // Apache Common Log Format
var Logparser = require('logagent-js')
var lp = new Logparser('node_modules/logagent-js/patterns.yml')
var path = require('path');
var stream = require('stream');

/* Globals */
var esDomain = {
    endpoint: 'https://search-staging-log-analytics-jledw5gksxxtxpcunpfs3ui5k4.us-west-2.es.amazonaws.com/',
    //endpoint: 'https://search-test-log-analyzer-jsvdkhdungxeywrigarrjmedii.us-west-2.es.amazonaws.com/',
    //endpoint: 'https://search-compute-log-analyser-h4a2nxaj3ayh7nyizgijuii2uq.us-west-2.es.amazonaws.com/',
    region: 'us-west-2',
    index: 'staging-logs',
    doctype: 'default'
};
var endpoint =  new AWS.Endpoint(esDomain.endpoint);
var s3 = new AWS.S3();
var totLogLines = 0;    // Total number of log lines in the file
var numDocsAdded = 0;   // Number of log lines added to ES so far

/*
 * The AWS credentials are picked up from the environment.
 * They belong to the IAM role assigned to the Lambda function.
 * Since the ES requests are signed using these credentials,
 * make sure to apply a policy that permits ES domain operations
 * to the role.
 */
var creds = new AWS.EnvironmentCredentials('AWS');

/*
 * Get the log file from the given S3 bucket and key.  Parse it and add
 * each log record to the ES domain.
 */
function s3LogsToES(bucket, key, lineStream, recordStream) {
    // Note: The Lambda function should be configured to filter for .log files
    // (as part of the Event Source "suffix" setting).

    var s3Stream = s3.getObject({Bucket: bucket, Key: key}).createReadStream();

    // Flow: S3 file stream -> Log Line stream -> Log Record stream -> ES
    s3Stream
      .pipe(lineStream)
      .pipe(recordStream)
      .on('data', function(parsedEntry) {
          jsonParsedEntry = JSON.parse(parsedEntry);
          raw_key = key.replace(/[-\/]/g,'_');
          jsonParsedEntry["S3Key"]=raw_key;
          esDomain.doctype = jsonParsedEntry["_type"];
          //console.log("JSON Parsed Entry:", jsonParsedEntry);
          parsedEntry = JSON.stringify(jsonParsedEntry)
          console.log("Parsed Entry:", parsedEntry);
          postDocumentToES(parsedEntry);
      });

    s3Stream.on('error', function() {
        console.log(
            'Error getting object "' + key + '" from bucket "' + bucket + '".  ' +
            'Make sure they exist and your bucket is in the same region as this function.');
    });
}

/*
 * Add the given document to the ES domain.
 * If all records are successfully added, indicate success to lambda
 * (using the "context" parameter).
 */
function postDocumentToES(doc) {
    var req = new AWS.HttpRequest(endpoint);
    console.log("posting document to ES ************")
    req.method = 'POST';
    if(esDomain.doctype == null){
        esDomain.doctype = "default";
    }
    req.path = path.join('/', esDomain.index, esDomain.doctype);
    console.log("doctype : " + req.path)
    req.region = esDomain.region;
    req.body = doc;
    req.headers['presigned-expires'] = false;
    req.headers['Host'] = endpoint.host;

    // Sign the request (Sigv4)
    var signer = new AWS.Signers.V4(req, 'es');
    signer.addAuthorization(creds, new Date());
    console.log("------signed-------")
    // Post document to ES
    var send = new AWS.NodeHttpClient();
    console.log("@send : " + send)
    send.handleRequest(req, null, function(httpResp) {
        var body = '';
        console.log("-------handling request -------")
        httpResp.on('data', function (chunk) {
            body += chunk;
        });
        httpResp.on('end', function (chunk) {
            numDocsAdded ++;
            if (numDocsAdded == totLogLines) {
                // Mark lambda success.  If not done so, it will be retried.
                console.log('All ' + numDocsAdded + ' log records added to ES.');
            }
        });
    }, function(err) {
        console.log('Error: ' + err);
        console.log(numDocsAdded + 'of ' + totLogLines + ' log records added to ES.');
    });
}

var event1 = {
    "Records": [
        {
            "eventVersion": "2.0",
            "eventSource": "aws:s3",
            "awsRegion": "us-west-2",
            "eventTime": "2016-03-01T08:42:39.901Z",
            "eventName": "ObjectCreated:Put",
            "userIdentity": {
                "principalId": "AWS:AIDAI3LQQTO4RURMDMETK"
            },
            "requestParameters": {
                "sourceIPAddress": "49.44.57.231"
            },
            "responseElements": {
                "x-amz-request-id": "BD476B0575D75237",
                "x-amz-id-2": "nur/W5J+pwSuk8zEOpxz3iOgixVBd0oNLMph9agAUBeN/w/KUFK+dR/Ap0EesBEw"
            },
            "s3": {
                "s3SchemaVersion": "1.0",
                "configurationId": "MyElasticSearchStreaming",
                "bucket": {
                    "name": "staging-log-dir",
                    "ownerIdentity": {
                        "principalId": "A2GX7JMHUJDOBN"
                    },
                    "arn": "arn:aws:s3:::staging-log-dir"
                },
                "object": {
                    "key": "nova-cert-040107.log",
                    "size": 441936,
                    "eTag": "07ff1593ebbe382154a2c3018ddd5201",
                    "sequencer": "0056D555FC06AC1840"
                }
            }
        }
    ]
}

var event2 = { "Records": [ { "eventVersion": "2.0", "eventSource": "aws:s3", "awsRegion": "us-west-2", "eventTime": "2016-03-01T11:43:31.147Z", "eventName": "ObjectCreated:Put", "userIdentity": { "principalId": "AWS:AIDAI3LQQTO4RURMDMETK" }, "requestParameters": { "sourceIPAddress": "49.44.57.231" }, "responseElements": { "x-amz-request-id": "9AE99668A9F9161B", "x-amz-id-2": "xP0TTrngGafs07hIGZGRhWhCAnOjlL/f3kXzOwrFncm9WphFhxmN1OMJZ/HE/DJh" }, "s3": { "s3SchemaVersion": "1.0", "configurationId": "ElasticSearchLogStreaming", "bucket": { "name": "staging-log-dir", "ownerIdentity": { "principalId": "A2GX7JMHUJDOBN" }, "arn": "arn:aws:s3:::staging-log-dir" }, "object": { "key": "glance-registry-040231.log", "size": 978908, "eTag": "f7dbd49cee7d8e4d60ed9f9cdd91511a", "sequencer": "0056D58049A8893AB1" } } } ] }

var event3 = { "Records": [ { "eventVersion": "2.0", "eventSource": "aws:s3", "awsRegion": "us-west-2", "eventTime": "2016-03-02T08:59:22.165Z", "eventName": "ObjectCreated:Put", "userIdentity": { "principalId": "AWS:AIDAI3LQQTO4RURMDMETK" }, "requestParameters": { "sourceIPAddress": "49.44.57.231" }, "responseElements": { "x-amz-request-id": "2EEB8AE9534039A8", "x-amz-id-2": "E+3BmK78x8hVV0bptusS/1yx242FftkJEAGy+FdeudvMdB48cr32BgcdR7oU2YQA" }, "s3": { "s3SchemaVersion": "1.0", "configurationId": "ElasticSearchLogStreaming", "bucket": { "name": "staging-log-dir", "ownerIdentity": { "principalId": "A2GX7JMHUJDOBN" }, "arn": "arn:aws:s3:::staging-log-dir" }, "object": { "key": "ec2-api-040238.log", "size": 8255319, "eTag": "3fb4ef89b140867666918397e456fe8e", "sequencer": "0056D6AAE7F0203AD4" } } } ] }

/* Lambda "main": Execution starts here */
function call(event) {
    console.log('Received event: ', JSON.stringify(event, null, 2));
    
    /* == Streams ==
    * To avoid loading an entire (typically large) log file into memory,
    * this is implemented as a pipeline of filters, streaming log data
    * from S3 to ES.
    * Flow: S3 file stream -> Log Line stream -> Log Record stream -> ES
    */
    var lineStream = new LineStream();
    var serializedRecord;
    // A stream of log records, from parsing each log line
    var recordStream = new stream.Transform({objectMode: true})
    recordStream._transform = function(line, encoding, done) {
        //var logRecord = parse(line.toString());
        //var serializedRecord;
        lp.parseLine(line.toString(), 'source', function (err, data) {
          if(err) {
            console.log(data);
            console.log('line did not match with any pattern');
          }
          serializedRecord = JSON.stringify(data);//(logRecord);
        });
        this.push(serializedRecord);
        totLogLines ++;
        done();
    }

    event.Records.forEach(function(record) {
        var bucket = record.s3.bucket.name;
        var objKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        s3LogsToES(bucket, objKey, lineStream, recordStream);
    });
}

call(event3);
