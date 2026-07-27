# bHaptics Event Registration Specifications

This document lists the **28 candidate-specific bHaptics event names**, **5 canonical category fallbacks**, and **1 neutral fallback** required for hardware pattern playback in the bHaptics Player environment.

> [!IMPORTANT]
> The current codebase includes deterministic candidate resolution and indicator/dry-run fallbacks.
> For physical sleeve playback, each event name listed below must be created and registered in **bHaptics Designer / Portal** (`https://designer.bhaptics.com`) and loaded into the local **bHaptics Player**.

---

## 1. Candidate-Specific Event Names (28 Total)

### Start Category (6 Candidates)
- `assist_start_high_01` (`start_high_01_v-09-11-4-3`)
- `assist_start_high_02` (`start_high_02_v-10-21-3-11`)
- `assist_start_high_03` (`start_high_03_v-09-18-4-16`)
- `assist_start_low_01` (`start_low_01_v-09-16-1-56`)
- `assist_start_low_02` (`start_low_02_v-09-10-6-59`)
- `assist_start_low_03` (`start_low_03_v-10-21-3-7`)

### Finish Category (6 Candidates)
- `assist_finish_high_01` (`finish_high_01_v-09-10-12-2`)
- `assist_finish_high_02` (`finish_high_02_v-09-11-3-21`)
- `assist_finish_high_03` (`finish_high_03_v-09-12-8-13`)
- `assist_finish_low_01` (`finish_low_01_v-10-21-3-39`)
- `assist_finish_low_02` (`finish_low_02_v-09-10-3-56`)
- `assist_finish_low_03` (`finish_low_03_v-10-21-3-17`)

### Reps Category (6 Candidates)
- `assist_reps_high_01` (`reps_high_01_v-09-16-1-43`)
- `assist_reps_high_02` (`reps_high_02_v-09-12-8-30`)
- `assist_reps_high_03` (`reps_high_03_v-09-18-4-16`)
- `assist_reps_low_01` (`reps_low_01_v-09-10-7-36`)
- `assist_reps_low_02` (`reps_low_02_v-09-18-4-15`)
- `assist_reps_low_03` (`reps_low_03_v-09-11-4-22`)

### Speed Up Category (6 Candidates)
- `assist_speed_up_high_01` (`speed_up_high_01_v-09-10-3-52`)
- `assist_speed_up_high_02` (`speed_up_high_02_v-10-21-3-11`)
- `assist_speed_up_high_03` (`speed_up_high_03_v-10-21-3-7`)
- `assist_speed_up_low_01` (`speed_up_low_01_v-10-23-1-16`)
- `assist_speed_up_low_02` (`speed_up_low_02_v-10-09-5-7`)
- `assist_speed_up_low_03` (`speed_up_low_03_v-10-21-3-4`)

### Slow Down Category (4 Candidates)
- `assist_slow_down_high_01` (`slow_down_high_01_v-09-11-3-54`)
- `assist_slow_down_high_02` (`slow_down_high_02_v-09-12-1-19`)
- `assist_slow_down_low_01` (`slow_down_low_01_v-09-10-11-55`)
- `assist_slow_down_low_02` (`slow_down_low_02_v-09-23-6-24`)

---

## 2. Canonical Category Fallbacks (5 Total)

- `assist_start`
- `assist_finish`
- `assist_reps`
- `assist_speed_up`
- `assist_slow_down`

---

## 3. Neutral Fallback (1 Total)

- `assist_attention_double` (Used when an unclassifiable cue request is encountered)

---

## 4. Conversion Status

In `frontend/public/haptics/manifest.json`, the `conversion_status` for all 28 candidates is marked as `pending_bhaptics_authoring`. Once `.tact` pattern files are authored and registered in the bHaptics Designer/Player environment, `conversion_status` can be updated to `converted`.
