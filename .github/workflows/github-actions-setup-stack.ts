import { Construct } from 'constructs';
import { Stack, StackProps, aws_iam } from 'aws-cdk-lib';

export interface GitHubActionsSetupStackProps extends StackProps {
  principalFederatedSub: string;
}

export class GitHubActionsSetupStack extends Stack {
  constructor(scope: Construct, id: string, props: GitHubActionsSetupStackProps) {
    super(scope, id, props);

    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;

    const gitHubIdProvider = new aws_iam.OpenIdConnectProvider(
      this,
      'GitHubIdProvider',
      {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      }
    );

    const oidcDeployRole = new aws_iam.Role(this, 'GitHubOidcRole', {
      roleName: 'github-oidc-role',
      assumedBy: new aws_iam.FederatedPrincipal(
        gitHubIdProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub':
              props.principalFederatedSub,
          },
        },
        'sts:AssumeRoleWithWebIdentity' //これを忘れるとStatementのActionが'sts:AssumeRole'となりOIDCでのAssumeRoleで使えなくなる。
      ),
    });

    const deployPolicy = new aws_iam.Policy(this, 'deployPolicy', {
      policyName: 'deployPolicy',
      statements: [
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: [
            's3:getBucketLocation',
            's3:List*',
            'cloudformation:CreateStack',
            'cloudformation:CreateChangeSet',
            'cloudformation:DeleteChangeSet',
            'cloudformation:DescribeChangeSet',
            'cloudformation:DescribeStacks',
            'cloudformation:DescribeStackEvents',
            'cloudformation:ExecuteChangeSet',
            'cloudformation:GetTemplate',
          ],
          resources: [
            'arn:aws:s3:::*',
            `arn:aws:cloudformation:${region}:${accountId}:stack/CDKToolkit/*`,
            `arn:aws:cloudformation:${region}:${accountId}:stack/*/*`,
          ],
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:GetObject'],
          resources: [`arn:aws:s3:::cdk-*-assets-${accountId}-${region}/*`],
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${region}:${accountId}:parameter/cdk-bootstrap/*/version`,
          ],
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [
            `arn:aws:iam::${accountId}:role/cdk-*-cfn-exec-role-${accountId}-${region}`,
          ],
        }),
      ],
    });

    oidcDeployRole.attachInlinePolicy(deployPolicy);
  }
}
