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
    //endpoint: 'https://search-staging-log-analytics-jledw5gksxxtxpcunpfs3ui5k4.us-west-2.es.amazonaws.com/',
    endpoint: 'https://search-test-log-analyzer-jsvdkhdungxeywrigarrjmedii.us-west-2.es.amazonaws.com/',
    //endpoint: 'https://search-compute-log-analyser-h4a2nxaj3ayh7nyizgijuii2uq.us-west-2.es.amazonaws.com/',
    region: 'us-west-2',
    index: 'staging-logs',
    doctype: 'default'
};
var endpoint =  new AWS.Endpoint(esDomain.endpoint);
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
 * Add the given document to the ES domain.
 * If all records are successfully added, indicate success to lambda
 * (using the "context" parameter).
 */
function postDocumentToES(doc) {
    var req = new AWS.HttpRequest(endpoint);
    console.log("posting document to ES ************")
    req.method = 'POST';
    req.path = path.join('/', esDomain.index, esDomain.doctype);
    console.log("doctype : " + req.path)
    req.region = esDomain.region;
    req.body = doc;
    req.headers['presigned-expires'] = false;
    req.headers['Host'] = endpoint.host;
    console.log("request : " + req.body)
    // Sign the request (Sigv4)
    var signer = new AWS.Signers.V4(req, 'es');
    signer.addAuthorization(creds, new Date());
    console.log("------signed-------")
    // Post document to ES
    var send = new AWS.NodeHttpClient();
    console.log("send : ", send)
    send.handleRequest(req, null, function(httpResp) {
        var body = '';
        console.log("-------handling request---------")
        httpResp.on('data', function (chunk) {
            body += chunk;
        });
        httpResp.on('end', function (chunk) {
            console.log("-----ending-----")
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

var lp = new Logparser('node_modules/logagent-js/patterns.yml')
var str = '2016-02-23 06:29:19.753 19811 DEBUG nova.openstack.common.loopingcall [req-a4e49236-601f-4426-bff9-564b767245f8 - - - - -] Dynamic looping call <bound method Service.periodic_tasks of <nova.service.Service object at 0x7f660dede1d0>> sleeping for 60.00 seconds _inner /usr/lib/python2.7/dist-packages/nova/openstack/common/loopingcall.py:132'
lp.parseLine(str, 'source name', function (err, data) {
    if(err) {
        console.log('line did not match with any pattern')
    }
    console.log(JSON.stringify(data) + "\n#" + totLogLines)
    totLogLines ++;
    postDocumentToES(JSON.stringify(data))
})

