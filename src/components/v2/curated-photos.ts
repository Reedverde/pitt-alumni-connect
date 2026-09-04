import { photoUrl } from "@/lib/photo-slots";

export type V2CuratedPhoto = { src: string; alt: string };

function photo(storagePath: string, alt: string): V2CuratedPhoto {
  return { src: photoUrl(storagePath), alt };
}

/**
 * Hand picked action frames from the project's own photo library: players
 * throwing, marking, skying and competing. Every entry is a real row in the
 * photos table, referenced by its storage path. Nothing here is stock.
 */
export const ACTION = {
  /** A handler stepping out and throwing around a mark. */
  aroundTheMark: photo(
    "39c85524-4a91-470e-8c14-9171604cbd99.jpg",
    "A Pitt handler stepping out and throwing around a mark",
  ),
  /** A player up in the air, skying a defender for the catch. */
  sky: photo(
    "5cefac0f-5e30-46e2-a7fb-e2dd14d3dd9e.jpg",
    "A Pitt player skying for a catch over a defender",
  ),
  /** Tight crop on a receiver bringing in the disc. */
  catchClose: photo(
    "19b2b99d-aba5-42af-beac-c7e7f85db7c7.jpg",
    "A Pitt player reaching in to bring down a throw",
  ),
  /** Two players running downfield with the disc under the lights. */
  nightRun: photo(
    "b94f0cc3-a933-437e-9882-935e8f789383.jpg",
    "A Pitt player running downfield with the disc under the lights",
  ),
  /** A contested throw on turf, thrower and mark locked up. */
  contested: photo(
    "620f403f-24b3-4b3c-b0b9-398620b64a9c.jpg",
    "Two players contesting a throw on a turf field",
  ),
} as const;

/**
 * Photographs from past Alumni Weekends specifically, not general season or
 * Nationals imagery. These are the alumni game gatherings we actually have on
 * file, mapped to the day of the weekend each one speaks to.
 */
export const ALUMNI_WEEKEND = {
  friday: photo(
    "de5f3892-ca21-4233-810c-2a8ccd9e7522.jpg",
    "Alumni and current players together under the Hail to Pitt banner at Alumni Weekend, 2013",
  ),
  saturday: photo(
    "2fc1005d-266f-459c-b7f5-85320f1435e4.jpg",
    "Alumni and current players spread out on the grass after the alumni game, 2012",
  ),
  sunday: photo(
    "b85beec7-671b-41a2-a195-f2335eb3852d.jpg",
    "Alumni and current players lined up on a cold day for the alumni game, 2014",
  ),
} as const;
