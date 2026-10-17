// The photo-type round: which of three kinds a photograph is, said by a
// person, to measure a rule against (Q4 in docs/photo-critic.md).
//
// The rule (food / place / scenery, from Vision's stored labels) was
// written and frozen before anyone looked at these, and the sample was
// drawn from what it said — 30 of each kind it named, and 10 it was
// unsure of, shuffled — so its precision per kind can be read straight
// off the answers. The page never shows what the rule said: an answer
// given beside a guess leans toward the guess.
//
// The answers stay on the phone that gave them (localStorage) and leave
// it as one line of letters, one per photograph in this order, pasted
// back into the conversation that drew the sample. Nothing is written to
// the database: this is a measurement, not a label the catalog keeps.

/** Round 1, 17 Oct 2026: 100 of the 434 photographs scored by then. */
export const SAMPLE = [
  '2e2be6be-057d-46f3-92a7-bdea0e55dd63',
  '3aa180c5-d2ee-4534-b7ba-45a32a2e0418',
  '0dc516a9-dc77-4a76-8c61-7eaeebc842b2',
  'ab108496-bd57-41a8-a3ab-c6029ff861da',
  '909f5459-de9d-4690-98dd-338e1a80c4ca',
  '509a615b-9d14-4551-acca-087d4ab03654',
  '3a9445b5-2132-4175-b55b-1648abd139cf',
  '7230a143-e17c-4c98-a262-a90b6d6a322c',
  'ab1b7dc8-e211-473d-a03e-ec192e7ff05c',
  'd54807f0-047b-4c5c-992f-6d980f78262c',
  '8fe75ea3-0798-459f-b354-cbb54fd2c642',
  '7715a348-66ba-41d9-abb8-76432d76740e',
  '586ee3b2-ca1f-4b4b-88d6-c23f25205bd6',
  'fcf257e5-60fe-4a8b-9da3-1cbc9285e5f1',
  '60582cfd-655f-45cb-ab88-18ee928ab5dd',
  'e84ae6ca-aebe-4f98-b5f8-2d7c41739991',
  '9b35ad75-6029-4c5a-b447-040cb6a39d57',
  'a814a84a-f8e7-4f55-bd5b-c9aa7442fe6f',
  '3697c665-9342-4a21-bd6d-95390a146741',
  '30daec93-8ce7-4f99-aa14-22bcb66f9a19',
  '2210afd3-478e-439a-8e80-34d88b077962',
  '3ae163d5-0a09-4c82-8f64-99113b2c2a21',
  '9642f019-1d39-4fd6-a8f8-71e6d6444b92',
  '54f06784-bc25-4149-b318-c33b54d70a85',
  '4e35f639-467e-4cd9-9a97-e613c231d564',
  'd2d9ccb7-a591-4613-bf8a-5a6f59893e71',
  '44532e62-9850-4a10-89b4-b662f9891172',
  '39bfe4d3-fd82-4810-8f34-477a1df2ddc8',
  '4326ab81-5a36-4eb6-b7e6-10d98431767e',
  'c87e6610-ce99-4332-8bb8-2ec8425d9d3d',
  '6a29e9ea-310b-45d0-a1d8-bd460f74ff4a',
  '8c7d4c5c-c805-42ce-b16b-c1fe9d0775ee',
  '23a34e50-207d-4b52-923c-a2b659f04725',
  '98b289e6-9c6b-4ca0-ab10-c5ef8246d212',
  'e3ba5148-5341-4ce4-a091-8529d2300fb8',
  '6c62c06d-03c4-4ea1-8f7d-07b831bb4776',
  '1c598f80-50d4-4fae-8408-7a94a216eedc',
  'df7824d4-3e36-4853-bbfb-d1e8ff4da595',
  '6181f888-52e1-43e1-8336-915c830583ac',
  'bd1f11d9-059d-4c5a-bb70-c516f8b1ab72',
  'a145a399-3ac6-4eca-b55d-70e0315e5659',
  '999969fd-703d-4f70-86e2-17ddcee2d031',
  '71a813cd-e344-40af-8adb-d118d87477a1',
  '543453aa-9555-4496-bfee-86ec060fe471',
  '5e5019f5-c19b-47b2-8c76-9e9594d82008',
  '1f4ddcef-e1c9-4403-b287-8c868238431e',
  '1a63697b-3c83-4d26-9380-475768d07df2',
  'f9bb4f09-776e-4d34-a435-0982daadd2dd',
  '073ff5ac-ee55-4790-bea7-7501b2b735e3',
  '0042499a-ac3c-4922-88b4-13370257230c',
  'a2c021dd-4151-4232-be06-0f27de23cdc1',
  'b1f6ab04-3e0a-489b-9078-a75e9d743332',
  '3d298df1-4f2f-49b6-8a91-be7831a2418a',
  '4eb693e4-5d14-42b5-a3ee-36b0b79e5331',
  '9a8b5853-7ee1-4051-b3ba-3a97fa4ffc6c',
  '8f90f60a-2d68-461b-8bc9-17411bbb154b',
  '91a8d12c-ab15-4505-8ef2-bceb81f59f84',
  'a574b2bc-e796-4362-9384-220592f614fa',
  'c40cb7e9-05b1-4445-9acd-a257872f4ed0',
  '6b860ef9-00b2-4b84-b2bc-30b39ad5b0fd',
  '24533a39-1eb0-4a73-95bd-8dc2be9ef92c',
  '93d9553e-8582-4c05-bffc-3af43f357ffe',
  '72bb88b8-289c-4af7-80e1-c3e85ed8e6f4',
  '170fc447-ecc8-4e14-93df-712f31f1dc28',
  '9780d05d-403f-414a-b5ce-58dde7d7d794',
  'a5e5dc88-8096-4a61-b2ca-e160aa8e1de6',
  'adb469e9-6845-4b49-81ee-c79191faff1a',
  '117cee66-be07-4296-baa5-c2958fbdf397',
  '6b981aa1-35da-41a3-a3ef-99d057f34016',
  'bcb09e2e-a37d-4926-a7a7-885d1b3071d8',
  'a5f6d2db-fbd2-4b2a-84c1-5646b9b4049e',
  'beeacad8-d45f-4030-a324-4fdb4ec30e32',
  '8c855c54-ad92-4489-850e-7f350ac2f8a7',
  'a3d5fc3b-6f20-4e9d-98eb-4e196c4fd7a1',
  '2625b14c-3870-4838-8b0f-5bbddfb806bd',
  'a902bb0c-82cf-4bec-b8b5-df9405957e7b',
  '33d9b4d9-a386-458b-a5c1-d72b97349d68',
  'c1f68313-a64c-4701-9dca-328e0e5fe55f',
  '578b6362-c4a0-4500-8aa8-5fa6ef2208ee',
  'ecfeb5ae-02ef-4e52-81a1-e59a928eca84',
  '2a13861b-3642-489b-9389-d7858a3206ae',
  'd63225a0-f574-482c-ba87-dd20ecb02f7a',
  '2489fbb4-d6a6-4174-9995-341454642ef9',
  '72f69510-0419-43b8-a0da-42c2e4a85719',
  '7bbc7697-6b5d-4a11-941e-a428e394345b',
  '51be20f7-f94c-4523-a174-3ce395e87a73',
  'd63e9b29-46b7-41b0-9771-6456c23db3be',
  '3035e7fc-d1be-42fb-bbf4-28f31e596d90',
  'c0a84117-1cd7-4f89-9ca1-5a70531c43eb',
  '1d97033f-6e6d-46e1-af35-2e887f8e50c1',
  '93cf4968-969b-4d27-b15b-9c14c4c6a519',
  'f17a5aed-cd35-49b4-a92b-df78b0f1cee6',
  '1bbf66c3-3bfd-4edb-906f-771864d34a6c',
  'eca691ec-98c0-4bb0-950c-f7cd018cf142',
  'a53d73e8-40f0-48ec-a533-4c85c0f8f4cd',
  'b28b6938-3659-45e5-82bc-6bf6ec82afe5',
  'f9ab6ce4-692a-4199-bea2-50cd3745769c',
  '5e23c21e-fa5e-4a7b-b1b5-60e643ae5be4',
  'd64ad209-4edb-40de-9793-828e84778009',
  '2a1e01a2-9785-4eff-9fd6-6cfe162ba423',
];

/** The answers, and the letter each is written as. */
export const KINDS = [
  { key: 'F', vi: 'Món ăn', en: 'Food' },
  { key: 'P', vi: 'Địa điểm', en: 'Place' },
  { key: 'S', vi: 'Phong cảnh', en: 'Scenery' },
  { key: 'U', vi: 'Không rõ', en: 'Not sure' },
];

/** The answers as one line: a letter per photograph, `-` where none. */
export const encode = (labels) => SAMPLE.map((id) => labels[id] ?? '-').join('');

/** Where to pick up: the first photograph with no answer, or the end. */
export function firstOpen(labels) {
  const i = SAMPLE.findIndex((id) => !labels[id]);
  return i === -1 ? SAMPLE.length : i;
}
