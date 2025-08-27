import axios from 'axios';
import * as cheerio from 'cheerio';
import Fuse from 'fuse.js';
import sharp from 'sharp';

// --- Type Definitions ---

interface SuccessResult {
  match: true;
  name: string;
  photo: Buffer;
}

interface FailureResult {
  match: false;
}

type FindPersonResult = SuccessResult | FailureResult;

interface ScrapedPerson {
  name: string;
  photoUrl: string;
}

/**
 * Finds a person on the Stand.earth staff page, retrieves their photo,
 * converts it to a 300px PNG, and returns it.
 *
 * @param personName The name of the person to search for.
 * @returns A promise that resolves with the person's data or a not-found status.
 */
export async function findPersonAndPhoto(
  personName: string
): Promise<FindPersonResult> {
  const STAFF_URL = 'https://stand.earth/about/staff-board/';

  if (personName.trim() == '') return { match: false };

  try {
    const axiosConfig = {
      headers: {
        'User-Agent': 'Photo Lookup API/1.0',
      },
    };

    const { data: html } = await axios.get<string>(STAFF_URL, axiosConfig);
    const $ = cheerio.load(html);
    const staffList: ScrapedPerson[] = [];

    // Loop over each person's container card
    $('div.card').each((_, element) => {
      const name = $(element).find('strong').text().trim();

      // Get the raw HTML content from inside the <noscript> tag
      const noscriptHtml = $(element).find('noscript').html();
      let photoUrl = null;

      // If that content exists, load it into a new cheerio instance and find the image source
      if (noscriptHtml) {
        const $noscript = cheerio.load(noscriptHtml);
        photoUrl = $noscript('img').attr('src');
      }

      if (name && photoUrl) {
        staffList.push({ name, photoUrl });
      }
    });

    if (staffList.length === 0) {
      console.error('Scraper could not find any staff members on the page.');
      return { match: false };
    }

    // Use fuzzy matching to find the correct person
    const fuse = new Fuse(staffList, { keys: ['name'], threshold: 0.4 });
    const results = fuse.search(personName);

    if (results.length === 0) {
      return { match: false };
    }

    const bestMatch = results[0].item;

    // Download and process the image
    const imageResponse = await axios.get<Buffer>(bestMatch.photoUrl, {
      responseType: 'arraybuffer',
    });

    const processedPhoto = await sharp(imageResponse.data)
      .resize({
        width: 300,
        height: 300,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    return {
      match: true,
      name: bestMatch.name,
      photo: processedPhoto,
    };
  } catch (error) {
    console.error('An error occurred during the lookup process:', error);
    return { match: false };
  }
}
