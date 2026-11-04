package com.finguard.anomaly;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "detection.enabled", havingValue = "true", matchIfMissing = true)
public class DetectionWorker {
    private static final Logger log = LoggerFactory.getLogger(DetectionWorker.class);
    private final DetectionJobRepository jobs;
    private final DetectionService detection;
    public DetectionWorker(DetectionJobRepository jobs, DetectionService detection) {
        this.jobs = jobs; this.detection = detection;
    }
    @Scheduled(fixedDelayString = "${detection.poll-delay-ms:2000}")
    public void poll() {
        for (var job : jobs.findByCompletedFalseOrderByTransactionIdAsc(PageRequest.of(0, 20))) {
            try { detection.process(job.getTransactionId()); }
            catch (RuntimeException exception) {
                log.warn("Detection job {} remains pending; will retry on next poll", job.getTransactionId());
            }
        }
    }
}
