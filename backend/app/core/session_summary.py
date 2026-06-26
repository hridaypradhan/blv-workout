from datetime import datetime, timezone

def generate_session_summary(session) -> str:
    """Generate a consistent human-readable summary of the assisted workout session."""
    from app.core.session_store import SessionEventNames

    # Count the specific recorded events
    total_reps = len(session.reps)
    total_errors = len(session.form_errors)

    plays = 0
    pauses = 0
    seeks = 0
    speed_changes = 0
    assistant_cues = 0
    assistant_qa_answers = 0
    assistant_corrections = 0
    failed_qa_answers = 0
    haptic_cue_requests = 0
    haptic_cue_triggers = 0
    haptic_cue_failures = 0
    repeats = 0
    skips = 0
    user_questions = 0

    for event in session.playback_events:
        t = event.event_type
        if t == SessionEventNames.PLAY:
            plays += 1
        elif t == SessionEventNames.PAUSE:
            pauses += 1
        elif t == SessionEventNames.SEEK:
            seeks += 1
        elif t == SessionEventNames.SPEED_CHANGE:
            speed_changes += 1
        elif t == SessionEventNames.ASSISTANT_CUE_DELIVERED:
            assistant_cues += 1
        elif t == SessionEventNames.ASSISTANT_CORRECTION_DELIVERED:
            assistant_corrections += 1
        elif t == SessionEventNames.ASSISTANT_ANSWER_DELIVERED:
            assistant_qa_answers += 1
        elif t == SessionEventNames.ASSISTANT_ANSWER_FAILED:
            failed_qa_answers += 1
        elif t == SessionEventNames.HAPTIC_CUE_REQUESTED:
            haptic_cue_requests += 1
        elif t == SessionEventNames.HAPTIC_CUE_TRIGGERED:
            haptic_cue_triggers += 1
        elif t == SessionEventNames.HAPTIC_CUE_FAILED:
            haptic_cue_failures += 1
        elif t == SessionEventNames.TRAINER_INSTRUCTION_REPEATED:
            repeats += 1
        elif t == SessionEventNames.SECTION_SKIPPED:
            skips += 1
        elif t == SessionEventNames.USER_QUESTION_SUBMITTED:
            user_questions += 1

    # Count unique haptic cues (deduplicate requested + triggered/failed outcomes)
    final_outcomes = []
    requests = []
    for event in session.playback_events:
        t = event.event_type
        meta = event.metadata or {}
        cid = meta.get("cue_id") or meta.get("cueId")
        ts = event.timestamp_ms
        event_name = meta.get("bhaptics_event_name") or meta.get("cue_type") or meta.get("selected_vibration_id")
        delivery_mode = meta.get("delivery_mode")

        if t in ("haptic_cue_triggered", "haptic_cue_failed"):
            final_outcomes.append({
                "event_type": t,
                "cue_id": cid,
                "timestamp_ms": ts,
                "event_name": event_name,
                "delivery_mode": delivery_mode
            })
        elif t == "haptic_cue_requested":
            requests.append({
                "cue_id": cid,
                "timestamp_ms": ts,
                "event_name": event_name
            })

    matched_requests = set()
    for req_idx, req in enumerate(requests):
        req_cid = req["cue_id"]
        req_ts = req["timestamp_ms"]

        if req_cid is not None:
            matched = False
            for out in final_outcomes:
                if out["cue_id"] == req_cid:
                    matched = True
                    break
            if matched:
                matched_requests.add(req_idx)
                continue

        if req_ts is not None:
            for out in final_outcomes:
                out_ts = out["timestamp_ms"]
                if out_ts is not None and abs(out_ts - req_ts) <= 2000:
                    if not req["event_name"] or not out["event_name"] or req["event_name"] == out["event_name"]:
                        matched_requests.add(req_idx)
                        break

    unmatched_requests_count = len(requests) - len(matched_requests)
    
    hardware_cues = sum(1 for out in final_outcomes if out["delivery_mode"] == "hardware")
    indicator_cues = sum(1 for out in final_outcomes if out["delivery_mode"] in ("indicator", "dry_run"))
    failed_cues = sum(1 for out in final_outcomes if out["delivery_mode"] == "failed" or out["event_type"] == "haptic_cue_failed")

    # Build summary
    supplement_parts = []
    
    # Cues: sum up assistant cues
    all_assistant_cues = assistant_cues + assistant_corrections + assistant_qa_answers
    if all_assistant_cues > 0:
        supplement_parts.append(f"{all_assistant_cues} assistant cue{'s' if all_assistant_cues != 1 else ''}")
    
    # Haptic cues: distinguish physical hardware and indicator cues
    if hardware_cues > 0:
        supplement_parts.append(f"{hardware_cues} physical hardware cue{'s' if hardware_cues != 1 else ''}")
    if indicator_cues > 0:
        supplement_parts.append(f"{indicator_cues} indicator cue{'s' if indicator_cues != 1 else ''}")
    
    # Reps and form warnings
    reps_count = total_reps if total_reps > 0 else sum(1 for e in session.playback_events if e.event_type == SessionEventNames.PROTOTYPE_REP_DETECTED)
    errors_count = total_errors if total_errors > 0 else sum(1 for e in session.playback_events if e.event_type == SessionEventNames.PROTOTYPE_FORM_ERROR_DETECTED)

    if reps_count > 0:
        supplement_parts.append(f"{reps_count} tracked rep{'s' if reps_count != 1 else ''}")
    if errors_count > 0:
        supplement_parts.append(f"{errors_count} form warning{'s' if errors_count != 1 else ''}")

    # Include failures if they occurred
    failure_parts = []
    if failed_qa_answers > 0:
        failure_parts.append(f"{failed_qa_answers} assistant answer failure{'s' if failed_qa_answers != 1 else ''}")
    if failed_cues > 0:
        failure_parts.append(f"{failed_cues} haptic cue failure{'s' if failed_cues != 1 else ''}")
    
    if failure_parts:
        if len(failure_parts) == 1:
            fail_text = failure_parts[0]
        else:
            fail_text = ", ".join(failure_parts[:-1]) + f", and {failure_parts[-1]}"
        supplement_parts.append(f"encountered {fail_text}")

    if supplement_parts:
        if len(supplement_parts) == 1:
            supp_text = supplement_parts[0]
        else:
            supp_text = ", ".join(supplement_parts[:-1]) + f", and {supplement_parts[-1]}"
        supp_sentence = f"FitA11y supplemented the trainer with {supp_text}."
    else:
        supp_sentence = "FitA11y supplemented your session with real-time feedback."

    # User actions
    user_parts = []
    if repeats > 0:
        user_parts.append(f"repeated {repeats} trainer instruction{'s' if repeats != 1 else ''}")
    if skips > 0:
        user_parts.append(f"skipped {skips} section{'s' if skips != 1 else ''}")
    if user_questions > 0:
        user_parts.append(f"asked {user_questions} question{'s' if user_questions != 1 else ''}")
    
    playback_changes = plays + pauses + seeks + speed_changes
    if playback_changes > 0:
        user_parts.append(f"made {playback_changes} playback adjustment{'s' if playback_changes != 1 else ''}")

    if user_parts:
        if len(user_parts) == 1:
            user_text = user_parts[0]
        else:
            user_text = ", ".join(user_parts[:-1]) + f", and {user_parts[-1]}"
        user_sentence = f" You {user_text}."
    else:
        user_sentence = ""

    return f"Assisted playback session completed. {supp_sentence}{user_sentence}"
