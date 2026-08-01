package com.scanny.repository;

import com.scanny.entity.PlatformBroadcastAck;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformBroadcastAckRepository extends JpaRepository<PlatformBroadcastAck, PlatformBroadcastAck.AckId> {

    Optional<PlatformBroadcastAck> findByBroadcastIdAndUserId(UUID broadcastId, String userId);

    List<PlatformBroadcastAck> findByUserIdAndBroadcastIdIn(String userId, Collection<UUID> broadcastIds);
}
