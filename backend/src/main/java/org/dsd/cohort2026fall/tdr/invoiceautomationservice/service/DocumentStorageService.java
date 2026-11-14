package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import io.minio.*;
import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.BlobStorageProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.StorageException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.HttpStatusCode;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentStorageService {

    private static final String KEY_PREFIX = "invoices/";

    private final S3Client s3Client;
    private final BlobStorageProperties props;

    private volatile boolean bucketReady = false;

    /** Uploads the file and returns its object key, e.g. "invoices/3f2a...pdf". */
    public String store(MultipartFile file, String extension) {
        ensureBucket();
        String key = KEY_PREFIX + UUID.randomUUID() + "." + extension;
        try (InputStream in = file.getInputStream()) {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(props.bucket())
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromInputStream(in, file.getSize()));
            return key;
        } catch (Exception e) {
            throw new StorageException("Failed to store file in blob storage", e);
        }
    }

    /** Opens the stored file. Caller must close the stream. */
    public InputStream load(String key) {
        try {
            return s3Client.getObject(GetObjectRequest.builder()
                    .bucket(props.bucket())
                    .key(key)
                    .build());
        } catch (Exception e) {
            throw new StorageException("Failed to load file: " + key, e);
        }
    }

    /** Used to clean up if the database save fails after upload. */
    public void delete(String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(props.bucket())
                    .key(key)
                    .build());
        } catch (Exception e) {
            throw new StorageException("Failed to delete file: " + key, e);
        }
    }

    // Checked on first use instead of at startup, so a missing
    // bucket never stops teammates' apps from booting.
    private void ensureBucket() {
        if (bucketReady) return;
        synchronized (this) {
            if (bucketReady) return;
            try {
                boolean exists = doesBucketExist(props.bucket());
//                boolean exists = minioClient.bucketExists(
//                        BucketExistsArgs.builder().bucket(props.bucket()).build());
                if (!exists) {
//                    minioClient.makeBucket(
//                            MakeBucketArgs.builder().bucket(props.bucket()).build());
                    s3Client.createBucket(CreateBucketRequest.builder()
                            .bucket(props.bucket())
                            .build());
                }
                bucketReady = true;
            } catch (Exception e) {
                throw new StorageException("Blob storage unavailable or bucket setup failed", e);
            }
        }
    }

    private boolean doesBucketExist(String bucketName) {
        try {
            s3Client.headBucket(HeadBucketRequest.builder()
                    .bucket(bucketName)
                    .build());
            return true;
        } catch (NoSuchBucketException e) {
            return false;
        } catch (AwsServiceException e) {
            // Optional: Handle 404 explicitly if NoSuchBucketException isn't mapped
            if (e.statusCode() == HttpStatusCode.NOT_FOUND) {
                return false;
            }
            // Note: 403 Forbidden means the bucket exists (in your account or another),
            // but your credentials lack permission to access it.
            throw e;
        }
    }
}