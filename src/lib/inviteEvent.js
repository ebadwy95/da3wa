import { resolveInviteCopy, sanitiseInviteCopy } from "@/lib/inviteCopy";
import { timelineLabel } from "@/lib/timeline";

/**
 * The part of a wedding an invitation renders, in one language. Shared by a
 * guest's own invitation and the dashboard's preview, so the preview can never
 * show a card the guests don't get.
 *
 * Whitelist, not blacklist. A guest's invite link reaches this, and the event
 * record carries the couple's dashboard password in plain text, their phone
 * number, and the door scanners' codes. Returning the record as-is handed all
 * of that to every guest — the scanner codes alone would let someone check
 * people in at the door. Only what the invitation actually renders goes out.
 */
export function buildInviteEvent(fullEvent, language) {
  if (!fullEvent) return null;
  const english = language === "en";
  return {
    id: fullEvent.id,
    coupleNames: fullEvent.coupleNames,
    eventDate: fullEvent.eventDate,
    eventTime: fullEvent.eventTime || "",
    // A venue is a proper name, so the Arabic one is still right on an English
    // card when no English spelling was given — the map link is what gets a
    // guest there.
    venueName: (english && fullEvent.venueNameEn) || fullEvent.venueName || "",
    venueAddress: fullEvent.venueAddress || "",
    venueMapUrl: fullEvent.venueMapUrl || "",
    welcomeMessage: fullEvent.welcomeMessage || "",
    // The opening film has the names and the first line burned into it, so an
    // English card plays the English film when there is one. Without one it
    // still plays the Arabic film rather than none: the envelope and the music
    // are the same either way.
    inviteVideoUrl: (english && fullEvent.inviteVideoUrlEn) || fullEvent.inviteVideoUrl || "",
    invitePosterUrl: fullEvent.invitePosterUrl || "",
    inviteAudioUrl: fullEvent.inviteAudioUrl || "",
    inviteTheme: fullEvent.inviteTheme === "dark" ? "dark" : "light",
    // Both appear on the face of the invitation, so both have to cross the
    // whitelist — a new field that is not listed here silently never arrives.
    latinNames: fullEvent.latinNames || "",
    // Empty on an English card without English family names, which the page
    // replaces with "the families of the bride and groom" rather than putting
    // Arabic script in an English sentence.
    familyNames: english ? fullEvent.familyNamesEn || "" : fullEvent.familyNames || "",
    // Resolved here rather than on the client: the invitation should never
    // have to know what the default wording is, and sanitising again on the
    // way out means a record written before the validation existed cannot
    // reach a guest unchecked.
    inviteCopy: resolveInviteCopy(
      sanitiseInviteCopy(english ? fullEvent.inviteCopyEn : fullEvent.inviteCopy, language),
      language
    ),
    // Each entry is { at: "20:30", label: "دخلة العريس", icon: "groom" }.
    // Validated on the way out rather than trusted: this reaches every guest,
    // and an admin typo should not be able to break the invitation for all of
    // them.
    timeline: Array.isArray(fullEvent.timeline)
      ? fullEvent.timeline
          .filter((s) => s && /^\d{2}:\d{2}$/.test(s.at) && String(s.label || "").trim())
          .map((s) => ({ at: s.at, label: timelineLabel(s, language), icon: s.icon || "" }))
      : null,
  };
}
