package io.nutritrack.companion

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Android Health Connect Sync Worker for CMF Watch 3 Pro.
 *
 * Automatically queries Health Connect for:
 * - StepsRecord
 * - ActiveCaloriesBurnedRecord
 * - DistanceRecord
 * - ExerciseSessionRecord
 *
 * Sanitizes and generates stable deterministic document IDs:
 * `${userId}_${date}_${metricType}_cmf_watch_health_connect`
 * to guarantee that repeated daily synchronization updates existing records
 * without inflating calorie totals or creating duplicates.
 */
class HealthConnectSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    private val healthConnectClient by lazy { HealthConnectClient.getOrCreate(applicationContext) }
    private val firestore by lazy { FirebaseFirestore.getInstance() }
    private val auth by lazy { FirebaseAuth.getInstance() }

    override suspend fun doWork(): Result {
        val currentUser = auth.currentUser ?: return Result.retry()
        val userId = currentUser.uid

        // Define time range: past 7 days up to now
        val now = Instant.now()
        val startTime = now.minus(7, ChronoUnit.DAYS)

        try {
            val zoneId = ZoneId.systemDefault()

            // 1. Read Steps Records
            val stepsResponse = healthConnectClient.readRecords(
                ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, now)
                )
            )

            // Aggregate steps by date
            val stepsByDate = stepsResponse.records.groupBy {
                LocalDate.ofInstant(it.startTime, zoneId).toString()
            }.mapValues { entry ->
                entry.value.sumOf { it.count }
            }

            // 2. Read Active Calories Burned Records (CMF Watch Pro Active Energy)
            val activeCaloriesResponse = healthConnectClient.readRecords(
                ReadRecordsRequest(
                    recordType = ActiveCaloriesBurnedRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, now)
                )
            )

            val activeCaloriesByDate = activeCaloriesResponse.records.groupBy {
                LocalDate.ofInstant(it.startTime, zoneId).toString()
            }.mapValues { entry ->
                entry.value.sumOf { it.energy.inKilocalories }
            }

            // 3. Read Distance Records
            val distanceResponse = healthConnectClient.readRecords(
                ReadRecordsRequest(
                    recordType = DistanceRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, now)
                )
            )

            val distanceByDate = distanceResponse.records.groupBy {
                LocalDate.ofInstant(it.startTime, zoneId).toString()
            }.mapValues { entry ->
                entry.value.sumOf { it.distance.inMeters }
            }

            // Batch write to Firestore activityLogs collection
            val batch = firestore.batch()
            val syncTimestamp = Instant.now().toString()

            // Upload Steps with stable IDs
            stepsByDate.forEach { (dateStr, totalSteps) ->
                val logId = "${userId}_${dateStr}_steps_cmf_watch_health_connect"
                val docRef = firestore.collection("activityLogs").document(logId)
                val data = hashMapOf(
                    "logId" to logId,
                    "userId" to userId,
                    "date" to dateStr,
                    "metricType" to "steps",
                    "value" to totalSteps,
                    "unit" to "count",
                    "source" to "cmf_watch_health_connect",
                    "recordedTimestamp" to syncTimestamp,
                    "lastSyncedTimestamp" to syncTimestamp,
                    "metadata" to mapOf(
                        "device" to "CMF Watch 3 Pro",
                        "app" to "Nothing X"
                    )
                )
                batch.set(docRef, data, SetOptions.merge())
            }

            // Upload Active Calories with stable IDs
            activeCaloriesByDate.forEach { (dateStr, totalActiveCals) ->
                val logId = "${userId}_${dateStr}_active_calories_cmf_watch_health_connect"
                val docRef = firestore.collection("activityLogs").document(logId)
                val data = hashMapOf(
                    "logId" to logId,
                    "userId" to userId,
                    "date" to dateStr,
                    "metricType" to "active_calories",
                    "value" to Math.round(totalActiveCals),
                    "unit" to "kcal",
                    "source" to "cmf_watch_health_connect",
                    "recordedTimestamp" to syncTimestamp,
                    "lastSyncedTimestamp" to syncTimestamp,
                    "metadata" to mapOf(
                        "device" to "CMF Watch 3 Pro",
                        "metricNote" to "Wearable Active Energy Only (Non-Basal)"
                    )
                )
                batch.set(docRef, data, SetOptions.merge())
            }

            // Upload Distance
            distanceByDate.forEach { (dateStr, totalMeters) ->
                val logId = "${userId}_${dateStr}_distance_meters_cmf_watch_health_connect"
                val docRef = firestore.collection("activityLogs").document(logId)
                val data = hashMapOf(
                    "logId" to logId,
                    "userId" to userId,
                    "date" to dateStr,
                    "metricType" to "distance_meters",
                    "value" to Math.round(totalMeters),
                    "unit" to "meters",
                    "source" to "cmf_watch_health_connect",
                    "recordedTimestamp" to syncTimestamp,
                    "lastSyncedTimestamp" to syncTimestamp
                )
                batch.set(docRef, data, SetOptions.merge())
            }

            // Update user's wearable connection document
            val connectionRef = firestore.collection("wearableConnections").document(userId)
            val connectionData = hashMapOf(
                "userId" to userId,
                "deviceModel" to "CMF Watch 3 Pro",
                "companionApp" to "Nothing X / CMF Watch app",
                "platform" to "Android Health Connect",
                "isConnected" to true,
                "lastSyncedTimestamp" to syncTimestamp
            )
            batch.set(connectionRef, connectionData, SetOptions.merge())

            // Commit batch write
            batch.commit().await()

            return Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.retry()
        }
    }
}
