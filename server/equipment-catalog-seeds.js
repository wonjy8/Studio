import {randomUUID} from 'node:crypto';
// A stable key prevents a later startup from recreating models renamed/archived by administrators.
export function seedEquipmentCatalog(db,models){
 db.exec('SAVEPOINT catalog_reference_models');
 try{
  db.exec('CREATE TABLE IF NOT EXISTS equipment_catalog_seed_entries(seed_key TEXT PRIMARY KEY,model_id TEXT NOT NULL REFERENCES equipment_catalog(id))');
  for(const model of models){
   if(db.prepare('SELECT 1 FROM equipment_catalog_seed_entries WHERE seed_key=?').get(model.key))continue;
   const existing=db.prepare('SELECT id FROM equipment_catalog WHERE manufacturer=? COLLATE NOCASE AND name=? COLLATE NOCASE').get(model.manufacturer,model.name);
   const id=existing?.id||randomUUID();
   if(!existing)db.prepare('INSERT INTO equipment_catalog VALUES(?,?,?,?,?,NULL,NULL,1,0)').run(id,model.manufacturer,model.name,model.nickname,model.category);
   db.prepare('INSERT INTO equipment_catalog_seed_entries VALUES(?,?)').run(model.key,id);
  }
  db.exec('RELEASE catalog_reference_models');
 }catch(error){db.exec('ROLLBACK TO catalog_reference_models');db.exec('RELEASE catalog_reference_models');throw error;}
}
