# AWSLogAnalytics

This repository contains code for AWS lambda function 

- to stream data from AWS S3 

- and index in AWS ElasticSearch domain 

- to be visualized using kibana endpoint provided by AWS.


It uses logagent-js to parse logs to desired key-value pairs to enable indexing in elastic search domain.


##Steps :

- clone this repository to your local machine.

- Add or edit the following four global variables in s3_lambda_es.js file:

    endpoint, the Amazon ES domain endpoint

    region, the AWS region in which you created your Amazon ES domain

    index, the name of the Amazon ES index to use for data streamed from Amazon S3

    doctype, the Amazon ES document type of the streamed data. For more information, see Mapping Types in the Elasticsearch documentation.

            The following example from the s3_lambda_es.js configures the sample application to use the streaming-logs Amazon ES domain endpoint in the us-east-1 AWS region.
            
            /* Globals */
            var esDomain = {
                endpoint: 'search-streaming-logs-okga24ftzsbz2a2hzhsqw73jpy.us-east-1.es.a9.com',
                region: 'us-east-1',
                index: 'streaming-logs',
                doctype: 'apache'
            };
            
- copy the eslambda.zip file under eslambda directory to AWS bucket.

- create AWS lambda function.

- copy the S3 url of eslambda.zip in AWS bucket to AWS lambda code.

- create AWS lambda function with following configuration:

    Lambda Configuration:

    -Handler: s3_lambda_es.js.handler
    -Memory: The memory limit, based on which the EC2 instance type to use is determined. For now, the default should do.
    -Timeout: The default timeout value (3 seconds) is quite low for our use-case. 10 seconds might work better, but please adjust based on your testing.
 
 - Under events property of AWS S3 bucket containing logs, add this AWS lambda function to be called upon object creation.
 
 - On AWS ES domain console, you shall find kibana endpoint. Clink on that link to query and visualize your indexed data.

###Important Links - AWS Documentation 
- http://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-aws-integrations.html#es-aws-integrations-s3-lambda-es
- https://github.com/awslabs/amazon-elasticsearch-lambda-samples

