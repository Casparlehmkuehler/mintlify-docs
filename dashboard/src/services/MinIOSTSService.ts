import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

export interface MinIOCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    bucket: string;
    endpoint: string;
}

interface STSCredentials {
    AccessKeyId: string;
    SecretAccessKey: string;
    SessionToken?: string;
}

export class MinIOSTSService {
    private static readonly MINIO_ENDPOINT = 's3.lyceum.technology';
    private static readonly ROLE_ARN = 'arn:minio:iam:::role/idmp-external-auth-provider';

    /**
     * Generate S3 credentials using MinIO STS and JWT token
     */
    public static async generateS3Credentials(jwtToken: string): Promise<MinIOCredentials> {
        try {
            // Extract user ID from JWT token
            const userId = this.extractUserIdFromJWT(jwtToken);
            if (!userId) {
                throw new Error('Unable to extract user ID from JWT token');
            }

            // Generate bucket name
            const bucketName = `${userId}-lyceum`;

            // Construct MinIO STS endpoint URL
            const stsParams = new URLSearchParams({
                'Action': 'AssumeRoleWithCustomToken',
                'Token': jwtToken,
                'RoleArn': this.ROLE_ARN,
                'Version': '2011-06-15'
            });

            const stsUrl = `https://${this.MINIO_ENDPOINT}?${stsParams.toString()}`;

            console.log('Calling MinIO STS for credentials...');

            // Call MinIO STS endpoint
            const response = await fetch(stsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (!response.ok) {
                throw new Error(`MinIO STS request failed with status: ${response.status}`);
            }

            const xmlData = await response.text();

            // Parse XML response (MinIO STS returns XML)
            const credentials = this.parseSTSResponse(xmlData);

            const minioCredentials: MinIOCredentials = {
                accessKeyId: credentials.AccessKeyId,
                secretAccessKey: credentials.SecretAccessKey,
                sessionToken: credentials.SessionToken,
                bucket: bucketName,
                endpoint: this.MINIO_ENDPOINT
            };

            // Check if bucket exists and create if it doesn't
            await this.ensureBucketExists(minioCredentials);

            return minioCredentials;

        } catch (error) {
            console.error('Error generating S3 credentials via MinIO STS:', error);
            if (error instanceof Error) {
                throw new Error(`MinIO STS request failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Extract user ID from JWT token payload
     */
    private static extractUserIdFromJWT(token: string): string | null {
        try {
            // JWT format: header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            // Decode base64 payload
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload = JSON.parse(jsonPayload);

            // Try common user ID claims
            return payload.sub || payload.user_id || payload.id || payload.uid || null;
        } catch (error) {
            console.error('Error extracting user ID from JWT:', error);
            return null;
        }
    }

    /**
     * Parse MinIO STS XML response to extract credentials
     */
    private static parseSTSResponse(xmlData: string): STSCredentials {
        try {
            // Simple XML parsing for STS response
            // MinIO STS returns XML like:
            // <AssumeRoleWithWebIdentityResponse>
            //   <AssumeRoleWithWebIdentityResult>
            //     <Credentials>
            //       <AccessKeyId>...</AccessKeyId>
            //       <SecretAccessKey>...</SecretAccessKey>
            //       <SessionToken>...</SessionToken>
            //     </Credentials>
            //   </AssumeRoleWithWebIdentityResult>
            // </AssumeRoleWithWebIdentityResponse>

            const accessKeyMatch = xmlData.match(/<AccessKeyId>(.*?)<\/AccessKeyId>/);
            const secretKeyMatch = xmlData.match(/<SecretAccessKey>(.*?)<\/SecretAccessKey>/);
            const sessionTokenMatch = xmlData.match(/<SessionToken>(.*?)<\/SessionToken>/);

            if (!accessKeyMatch || !secretKeyMatch) {
                throw new Error('Unable to parse credentials from STS response');
            }

            return {
                AccessKeyId: accessKeyMatch[1],
                SecretAccessKey: secretKeyMatch[1],
                SessionToken: sessionTokenMatch ? sessionTokenMatch[1] : undefined
            };
        } catch (error) {
            console.error('Error parsing STS response:', error);
            console.error('Raw response:', xmlData);
            throw new Error('Failed to parse MinIO STS response');
        }
    }

    /**
     * Ensure the user's bucket exists, create if it doesn't
     */
    private static async ensureBucketExists(credentials: MinIOCredentials): Promise<void> {
        try {
            // Configure S3 client for MinIO
            const creds: {
                accessKeyId: string;
                secretAccessKey: string;
                sessionToken?: string;
            } = {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            };

            if (credentials.sessionToken) {
                creds.sessionToken = credentials.sessionToken;
            }

            const s3 = new S3Client({
                credentials: creds,
                endpoint: `https://${credentials.endpoint}`,
                forcePathStyle: true, // Required for MinIO
                region: 'us-east-1'
            });

            try {
                // Check if bucket exists
                console.log(`Checking if bucket exists: ${credentials.bucket} at endpoint: ${credentials.endpoint}`);
                await s3.send(new HeadBucketCommand({ Bucket: credentials.bucket }));
                console.log(`Bucket ${credentials.bucket} already exists`);
            } catch (error: any) {
                console.log(`HeadBucket error details:`, {
                    name: error.name,
                    message: error.message,
                    code: error.code,
                    statusCode: error.statusCode,
                    $fault: error.$fault,
                    $metadata: error.$metadata
                });

                if (error.statusCode === 404 || error.code === 'NoSuchBucket' || error.name === 'NotFound') {
                    // Bucket doesn't exist, create it
                    console.log(`Creating bucket: ${credentials.bucket}`);
                    try {
                        await s3.send(new CreateBucketCommand({ Bucket: credentials.bucket }));
                        console.log(`Bucket ${credentials.bucket} created successfully`);
                    } catch (createError: any) {
                        console.error(`CreateBucket error details:`, {
                            name: createError.name,
                            message: createError.message,
                            code: createError.code,
                            statusCode: createError.statusCode,
                            $fault: createError.$fault,
                            $metadata: createError.$metadata,
                            stack: createError.stack
                        });
                        throw createError;
                    }
                } else {
                    // Some other error occurred
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error ensuring bucket exists:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to ensure bucket ${credentials.bucket} exists: ${errorMessage}`);
        }
    }

    /**
     * Test if the generated credentials are valid
     */
    public static async testCredentials(credentials: MinIOCredentials): Promise<boolean> {
        try {
            // Configure S3 client for MinIO
            const creds: {
                accessKeyId: string;
                secretAccessKey: string;
                sessionToken?: string;
            } = {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            };

            if (credentials.sessionToken) {
                creds.sessionToken = credentials.sessionToken;
            }

            const s3 = new S3Client({
                credentials: creds,
                endpoint: `https://${credentials.endpoint}`,
                forcePathStyle: true, // Required for MinIO
                region: 'us-east-1'
            });

            // Test by checking bucket exists (bucket should exist after ensureBucketExists)
            await s3.send(new HeadBucketCommand({ Bucket: credentials.bucket }));
            return true;
        } catch (error) {
            console.error('Credential test failed:', error);
            return false;
        }
    }
}
