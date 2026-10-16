import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REF_DIR = path.join(__dirname, '../data/reference');

function loadJson(filename) {
  const filePath = path.join(REF_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[Warning] Справочник ${filename} не найден.`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

class Dictionary {
  constructor() {
    this.isLoaded = false;
    this.regions = [];
    this.cities = [];
    this.districts = [];
    this.livingAreas = [];
    this.streets = [];
    this.streetTypes = [];

    this.citiesSet = new Set();
    this.regionsSet = new Set();
    this.streetsSet = new Set();
    this.districtsSet = new Set();
    this.livingAreasSet = new Set();
    this.streetTypesSet = new Set();
  }

  load() {
    if (this.isLoaded) return;

    this.regions = loadJson('regions.json');
    this.cities = loadJson('cities.json');
    this.districts = loadJson('districts.json');
    this.livingAreas = loadJson('living_areas.json');
    this.streets = loadJson('streets.json');
    this.streetTypes = loadJson('street_types.json');

    this.regions.forEach(r => this.regionsSet.add(r.name?.toLowerCase().trim()));
    this.cities.forEach(c => this.citiesSet.add(c.name?.toLowerCase().trim()));
    this.districts.forEach(d => this.districtsSet.add(d.name?.toLowerCase().trim()));
    this.livingAreas.forEach(l => this.livingAreasSet.add(l.name?.toLowerCase().trim()));
    this.streets.forEach(s => this.streetsSet.add(s.name?.toLowerCase().trim()));
    this.streetTypes.forEach(t => this.streetTypesSet.add(t.name?.toLowerCase().trim()));

    this.isLoaded = true;
  }

  findCity(token) {
    const clean = token.toLowerCase().trim();
    if (this.citiesSet.has(clean)) {
      const match = this.cities.find(c => c.name.toLowerCase() === clean);
      return match ? match.name : null;
    }
    return null;
  }

  findRegion(token) {
    const clean = token.toLowerCase().trim();
    if (this.regionsSet.has(clean)) {
      const match = this.regions.find(r => r.name.toLowerCase() === clean);
      return match ? match.name : null;
    }
    return null;
  }

  findDistrict(token) {
    const clean = token.toLowerCase().trim();
    if (this.districtsSet.has(clean)) {
      const match = this.districts.find(d => d.name.toLowerCase() === clean);
      return match ? match.name : null;
    }
    return null;
  }

  findStreet(token) {
    const clean = token.toLowerCase().trim();
    if (this.streetsSet.has(clean)) {
      const match = this.streets.find(s => s.name.toLowerCase() === clean);
      return match ? match.name : null;
    }
    return null;
  }

  lookupDistrictByStreet(city, streetName) {
    if (!streetName) return null;
    const cleanStreet = streetName.toLowerCase().trim();
    const streetObj = this.streets.find(s => s.name.toLowerCase() === cleanStreet);
    
    if (streetObj && streetObj.district_id) {
      const dist = this.districts.find(d => d.id === streetObj.district_id);
      return dist ? dist.name : null;
    }
    return null;
  }
}

const dictionaryInstance = new Dictionary();
dictionaryInstance.load();

export default dictionaryInstance;