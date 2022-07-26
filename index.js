import _ from "lodash";
import AWS from "aws-sdk";
import chalk from "chalk";
import { URL } from "url";
import { v4 as uuidv4 } from "uuid";

export default function (config) {
  const Route53 = new AWS.Route53({
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  });

  const S3 = new AWS.S3({
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  });

  const BucketCreate = async (name) => {
    const bucketExists = await BucketExists(name);

    if (bucketExists) {
      return 0;
    }

    try {
      await S3.createBucket({
        Bucket: name,
      }).promise();
    } catch (error) {
      return false;
    }

    return 1;
  };

  const BucketExists = async (name) => {
    try {
      await S3.headBucket({
        Bucket: name,
      }).promise();
    } catch (error) {
      return false;
    }

    return true;
  };

  const BucketGetWebsite = async (name) => {
    try {
      return await S3.getBucketWebsite({
        Bucket: name,
      }).promise();
    } catch (error) {
      return {};
    }
  };

  const BucketUpdateWebsite = async (name, redirectUrl) => {
    const bucketGetWebsite = await BucketGetWebsite(name);
    const url = new URL(redirectUrl);
    const protocol = url.protocol.substring(0, url.protocol.length - 1);
    const hostName = url.href.substring(protocol.length + 3);

    if (
      _.get(bucketGetWebsite, "RedirectAllRequestsTo.HostName") === hostName &&
      _.get(bucketGetWebsite, "RedirectAllRequestsTo.Protocol") === protocol
    ) {
      return 0;
    }

    try {
      await S3.putBucketWebsite({
        Bucket: name,
        WebsiteConfiguration: {
          RedirectAllRequestsTo: {
            HostName: hostName,
            Protocol: protocol,
          },
        },
      }).promise();
    } catch (error) {
      return false;
    }

    return 1;
  };

  const Run = async (domain, hostedZoneName, redirectUrl) => {
    console.info(`${chalk.cyan(`Domain: ${domain}`)}`);
    console.info(`${chalk.cyan(`Redirect: ${redirectUrl}`)}`);

    console.info(`    |─ ${chalk.underline(`Creating Bucket for domain.`)}`);
    const bucketCreate = await BucketCreate(domain);

    if (bucketCreate === false) {
      throw new Error(`Failed to create bucket: ${domain}`);
    } else if (bucketCreate === 0) {
      console.info(
        `    |    └─ ${chalk.yellow(`Bucket already exists, skipping.`)}`
      );
    } else if (bucketCreate === 1) {
      console.info(`    |    └─ ${chalk.green(`Bucket created.`)}`);
    }

    console.info(`    |─ ${chalk.underline(`Updating website for Bucket.`)}`);
    const bucketUpdateWebsite = await BucketUpdateWebsite(domain, redirectUrl);

    if (bucketUpdateWebsite === false) {
      throw new Error(`Failed to update bucket website: ${domain}`);
    } else if (bucketUpdateWebsite === 0) {
      console.info(
        `    |    └─ ${chalk.yellow(`Bucket website unchanged, skipping.`)}`
      );
    } else if (bucketUpdateWebsite === 1) {
      console.info(`    |    └─ ${chalk.green(`Bucket website updated.`)}`);
    }

    console.info(`    |─ ${chalk.underline(`Creating Hosted Zone.`)}`);
    const zoneCreate = await ZoneCreate(hostedZoneName);

    if (!zoneCreate) {
      throw new Error(`Failed to create zone: ${hostedZoneName}`);
    } else if (zoneCreate.exists === true) {
      console.info(
        `    |    └─ ${chalk.yellow(`Hosted Zone already exists, skipping.`)}`
      );
    } else {
      console.info(`    |    └─ ${chalk.green(`Hosted Zone created.`)}`);
    }

    console.info(`    |─ ${chalk.underline(`Creating Hosted Zone Record.`)}`);
    const zoneRecordCreate = await ZoneRecordCreate(domain, zoneCreate.Id);

    if (!zoneRecordCreate) {
      throw new Error(`Failed to create Hosted Zone Record!`);
    } else if (zoneRecordCreate.exists === true) {
      console.info(
        `    |    └─ ${chalk.yellow(
          `Hosted Zone Record already exists, skipping.`
        )}`
      );
    } else {
      console.info(`    |    └─ ${chalk.green(`Hosted Zone Record created.`)}`);
    }

    console.info(`    └─ ${chalk.green(`Completed.`)}`);

    return {
      bucketCreate,
      bucketUpdateWebsite,
      zoneCreate,
      zoneRecordCreate,
    };
  };

  const ZoneCreate = async (name) => {
    const zoneExists = await ZoneExists(name);

    if (zoneExists) {
      zoneExists.exists = true;
      return zoneExists;
    }

    const { HostedZone } = await Route53.createHostedZone({
      CallerReference: uuidv4(),
      Name: name,
    }).promise();

    return HostedZone;
  };

  const ZoneExists = async (name) => {
    const { HostedZones } = await Route53.listHostedZones().promise();

    for (const zone of HostedZones) {
      if (name === zone.Name.slice(0, -1)) {
        return zone;
      }
    }
  };

  const ZoneRecordCreate = async (domain, HostedZoneId) => {
    const zoneRecordRead = await ZoneRecordRead(domain, HostedZoneId);

    const zoneRecord = _.find(_.get(zoneRecordRead, "ResourceRecordSets"), {
      Name: `${domain}.`,
      Type: "A",
    });

    if (_.isEqual(config.aws.route53, _.get(zoneRecord, "AliasTarget"))) {
      zoneRecordRead.exists = true;
      return zoneRecordRead;
    }

    return await Route53.changeResourceRecordSets({
      HostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: domain,
              Type: "A",
              AliasTarget: config.aws.route53,
            },
          },
        ],
      },
    }).promise();
  };

  const ZoneRecordRead = async (domain, HostedZoneId) => {
    return await Route53.listResourceRecordSets({
      HostedZoneId,
      StartRecordName: domain,
      StartRecordType: "A",
    }).promise();
  };

  return { Run, ZoneRecordCreate };
}
