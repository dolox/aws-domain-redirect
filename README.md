# aws-domain-redirect

A simple project to programmatically redirect a domain to a specific URL using AWS Route53 and AWS S3 Static Websites.

---

## Usage

**Install the node package:**

```bash
yarn add aws-domain-redirect;
```

**Redirect a Domain:**

```javascript
import AWSDomainRedirect from "aws-domain-redirect";
import config from "./config.js";

(async () => {
  const awsDomainRedirect = new AWSDomainRedirect(config);
  await awsDomainRedirect.Run("www.dolox.com", "dolox.com", "https://www.dolox.com/");
})();
```

---

## Configuration

| Key                                | Type      | Description                                                                                                  |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `aws.accessKeyId`                  | `string`  | Your AWS access key ID.                                                                                      |
| `aws.accessKeyId`                  | `string`  | Your AWS secret access key.                                                                                  |
| `aws.route53.DNSName`              | `string`  | The AWS S3 Bucket DNS Name. See: https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html |
| `aws.route53.EvaluateTargetHealth` | `boolean` | See: https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html                            |
| `aws.route53.HostedZoneId`         | `string`  | See: https://docs.aws.amazon.com/sdk-for-ruby/v1/api/AWS/Route53/HostedZone.html                             |

**Example:**

```json
{
  "aws": {
    "accessKeyId": "...",
    "secretAccessKey": "...",

    "route53": {
      "DNSName": "s3-website-us-east-1.amazonaws.com.",
      "EvaluateTargetHealth": false,
      "HostedZoneId": "Z3AQBSTGFYJSTF"
    }
  }
}
```

---

## API

### async Run(domain, hostedZoneName, redirectUrl)

This Function will invoke the process of creating a bucket with the static website hosting redirect along with a hosted zone record. 

*Function Parameters:*

| Key            | Type     | Description                                |
| -------------- | -------- | ------------------------------------------ |
| domain         | `string` | The record name for the hosted zone entry. |
| hostedZoneName | `string` | The name of the hosted zone.               |
| redirectUrl    | `string` | The URL to redirect to.                    |

The Function will return an Object on success, or will throw an error upon failure.

*Return Object:*

| Key                 | Type     | Description                                   |
| ------------------- | -------- | --------------------------------------------- |
| bucketCreate        | `object` | Results from creating the bucket.             |
| bucketUpdateWebsite | `object` | Results from updating the bucket website.     |
| zoneCreate          | `object` | Results from creating the hosted zone.        |
| zoneRecordCreate    | `object` | Results from creating the hosted zone record. |

---

## AWS Permissions

This project needs access to programmatically:

- Read/Write AWS Route53 Hosted Zones
- Read/Write AWS Route53 Hosted Zone Records
- Read/Write AWS S3 Buckets
- Read/Write AWS S3 Static Website Redirects

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "aws-domain-redirect",
      "Effect": "Allow",
      "Action": [
        "route53:GetChange",
        "route53:GetHostedZone",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:DeleteHostedZone"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/*",
        "arn:aws:route53:::change/*"
      ]
    },
    {
      "Sid": "VisualEditor1",
      "Effect": "Allow",
      "Action": [
        "route53:CreateHostedZone",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "route53:ListHostedZones",
        "s3:CreateBucket",
        "s3:ListBucket"
      ],
      "Resource": "*"
    }
  ]
}
```

---

Copyright (c) 2022 Dolox, Inc.
