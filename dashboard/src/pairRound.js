// Photo labels, round 4: of two photographs of one kind at one place,
// which is the better photograph (docs/photo-labels.md §12)?
//
// The pairs were drawn by the rule written in
// data/review/photo-types/round4.json, before any model saw them: two
// photographs of the same kind at the same place, the kind a confident
// label, both read by Apple Vision. Apple Vision's pick (the higher
// aesthetic) and Claude's (the higher of two scores, each photograph
// scored alone against its kind's criteria) are sealed in that file with
// their sha256. This page never reads them.
//
// Which photograph is A and which is B is the draw's own order (md5 of
// the id), so neither judge's pick leans to a side. The kind is said
// above the pair: the criteria for a latte are not the criteria for a
// room, and the owner approved them per kind.
//
// As in rounds 1 to 3, the answers stay on the phone that gave them and
// leave it as one line to paste back.

/** The 60 pairs, in the order they are asked. E front, I interior, F food. */
export const PAIRS_4 = [
  ['E', '93d9553e-8582-4c05-bffc-3af43f357ffe', 'd63225a0-f574-482c-ba87-dd20ecb02f7a'],
  ['F', '0dc516a9-dc77-4a76-8c61-7eaeebc842b2', '2a1e01a2-9785-4eff-9fd6-6cfe162ba423'],
  ['E', 'a76fae32-06c3-471a-8823-a82b5b39b293', '5496fe4d-538a-44ad-bb8f-b73a632a8c32'],
  ['I', '7db832ce-ee95-4828-bd7f-0c334e4bbedc', '7f9737ea-8461-45d8-8733-fa76b205141d'],
  ['I', '951ab3cb-5a72-4320-9cc9-926a1d1eab9c', '2210afd3-478e-439a-8e80-34d88b077962'],
  ['E', '1ca4e884-c961-4fbf-b39c-5fd1723b6b99', 'ad7d6e29-782a-42bd-bfc0-004a8e307d52'],
  ['F', '6c62c06d-03c4-4ea1-8f7d-07b831bb4776', 'cb25a4dc-697b-494b-a10b-74059148e142'],
  ['F', '085b494d-344a-4dfc-8887-17d6e5f0f516', '12c3f28e-7bc1-4d77-938a-299a9ea8bd45'],
  ['E', '5e23c21e-fa5e-4a7b-b1b5-60e643ae5be4', '9a8b5853-7ee1-4051-b3ba-3a97fa4ffc6c'],
  ['I', '8c4e0c60-243e-4ec0-a674-714b34ba240d', '84eb9568-f5cf-448f-bb18-f7a7c84a1b13'],
  ['I', '29f7a6e1-5859-412f-8bb8-a58ea1bae232', '1bbf66c3-3bfd-4edb-906f-771864d34a6c'],
  ['I', 'd6896b41-7e51-4a3e-a6e4-b3c00d61f843', '9b452354-cce3-43a6-86ff-d32f1f9f45a0'],
  ['F', '9cd151ce-de33-4fa9-9842-4a45650abee2', '49cc7c31-c599-48dc-ba6f-5fae86dfc267'],
  ['F', 'd15f68ff-3f20-4d0c-8d82-36c9b86f17ba', '4f4b6772-8eb8-4b2c-8a2f-7cd724fd2291'],
  ['I', 'e1c74613-ca51-426e-b280-21d76bf9d754', 'a574b2bc-e796-4362-9384-220592f614fa'],
  ['E', '72bb88b8-289c-4af7-80e1-c3e85ed8e6f4', 'f17a5aed-cd35-49b4-a92b-df78b0f1cee6'],
  ['E', '3ae163d5-0a09-4c82-8f64-99113b2c2a21', 'e0bb4477-bffb-44ae-a14c-e0178dc39fe4'],
  ['E', '8f90f60a-2d68-461b-8bc9-17411bbb154b', '9780d05d-403f-414a-b5ce-58dde7d7d794'],
  ['E', 'c78663df-3d5a-440e-be59-5072f8b60d9d', 'd6d69846-8412-4fe3-8920-da4429ece5ae'],
  ['F', 'd54807f0-047b-4c5c-992f-6d980f78262c', '071dd43a-745a-41b4-b466-fc04e9447207'],
  ['F', '88e44ced-2693-4b90-a148-307c31e3c2d7', 'aac427d5-4fbd-4083-888f-f5f2924051f5'],
  ['E', 'a92c16f0-b93d-498c-823d-496347a6a7b5', 'ac8491ca-c1b8-46ca-b881-ab9c67fd1519'],
  ['I', '9446c864-8e3b-4c77-9828-14e8b09aef11', '26bf3ba5-0ed1-459a-8a5f-a2d65dc1c231'],
  ['F', 'c92196c5-a9ae-40ca-865a-72bc625c8ac0', 'a5f6d2db-fbd2-4b2a-84c1-5646b9b4049e'],
  ['I', 'cde61939-1379-4d48-b499-6bfb3e1f0305', '7f462103-84b7-44fe-8868-6bfbcf419df3'],
  ['F', '6af9627f-a7af-4cec-b4a8-7189327091df', 'd63e9b29-46b7-41b0-9771-6456c23db3be'],
  ['I', '94bd5450-7fe0-483e-8895-b1b8a1ba5067', 'fb6327f3-c578-4deb-8e4f-e34423b9ea76'],
  ['F', '182da842-e1f2-40fb-814b-62ef9fd7ea7e', 'c84341c1-5b78-497a-889b-302465faf7d8'],
  ['E', '3125bdc8-0294-422c-869c-77a59866e9cb', 'bcb8b60e-35be-4f25-9c64-6990617b70e4'],
  ['E', '2604cdf5-4311-419d-8b38-e32989b4f537', '88138b46-b50e-4d1f-a827-d8aad1c54a51'],
  ['I', 'b8bfe4b9-d521-47b2-ac42-6008ffcb70b9', 'f7b86afa-669e-4122-9acb-5ec74e9a68e6'],
  ['E', '33001810-b9f5-4efc-88c9-71f7ed07cdd2', 'ae8f9ef5-585d-4e56-a4be-c4522f5822f3'],
  ['F', '6ebc9e94-8558-4272-8ee2-e3bd90cf8e7e', 'deef1086-9d9f-45b9-9ed6-c65c6f3730a3'],
  ['I', 'bb37df4d-73c3-4d9a-9eef-7fea585aaf44', 'edab5e98-df56-4494-8694-70830e684099'],
  ['I', '8164fbc2-79fa-4619-8f87-b61ba4656fb5', 'eb8250e6-4ab2-4716-9596-f9f164a26280'],
  ['E', '544dcccd-4a21-4b39-a80e-80b515ce5f17', 'e84ae6ca-aebe-4f98-b5f8-2d7c41739991'],
  ['I', '069f76fb-4bfa-44c3-b9ef-3f3bca3f7d89', '7fcda699-e2eb-485e-ace9-df2edcbc2a35'],
  ['F', '45fbf53d-2e43-4791-94a5-08ba4cfaf9d7', '76cd90fd-e1f9-4d2e-bf11-06a2e1bd6ae6'],
  ['F', '9cad7070-da85-4b40-9b38-5916ae2a26fe', 'fa6fdaee-9bb3-404c-ac89-7332d09d18a8'],
  ['E', '5e5019f5-c19b-47b2-8c76-9e9594d82008', '170fc447-ecc8-4e14-93df-712f31f1dc28'],
  ['F', 'af946b23-75ea-41e6-a840-e7f414eabe02', '7230a143-e17c-4c98-a262-a90b6d6a322c'],
  ['I', '42963a01-c940-4273-a597-4c5f91b61eb9', 'bc34cca6-eea2-4dac-b14a-611f7e26891c'],
  ['F', '93cf4968-969b-4d27-b15b-9c14c4c6a519', 'a2fe4a3a-0b69-40c8-9014-9aeff92a793f'],
  ['I', '16b9d977-d764-428a-a51e-a473c68342fa', '2f3c5982-f55f-448f-bda6-b2c1f601aee6'],
  ['F', '69ea8deb-435b-475a-9607-1bbb0d50a564', '94ba025f-da1f-4d47-8a00-53217559f6a3'],
  ['I', 'cd860c5a-07a1-4889-9fe7-b48c7e568a3a', '46d6c88a-6608-49cc-aa9b-77ec78309000'],
  ['F', 'bf48e029-3089-4578-8dea-f271dc768320', '9642f019-1d39-4fd6-a8f8-71e6d6444b92'],
  ['I', '2917bb75-d399-4a65-b11e-0eb0691493ae', 'dbe65a09-2b23-4149-aa6f-00a31924532d'],
  ['I', '5bd200e8-cc79-4539-9196-b2674c49ed2b', '3aa180c5-d2ee-4534-b7ba-45a32a2e0418'],
  ['F', 'c0a84117-1cd7-4f89-9ca1-5a70531c43eb', '33d9b4d9-a386-458b-a5c1-d72b97349d68'],
  ['I', 'b9b1b75d-87a5-48b5-af21-f7a9437089e9', 'bee25dd6-5175-46c4-a4d2-7b675e6d315b'],
  ['E', 'd7aa36e7-1dc7-4be6-8bdb-6cfecb12bab3', '8a5e2c5a-8e09-456f-8ed5-a4195ac2215a'],
  ['I', '8a5202fd-5fa9-400a-b522-7d9d132db83c', '0f4ad60b-66e1-4eed-93d8-5bbbcc716bda'],
  ['F', 'feafeb22-879a-43a8-92c5-de8c632e925c', 'f37fac83-71bb-43b5-b255-86b19e1be9ee'],
  ['F', 'df699b4f-8e77-440a-bc79-863b2e87722f', '8c7d4c5c-c805-42ce-b16b-c1fe9d0775ee'],
  ['I', '965a7b61-1c3d-402e-a4d0-a8cb7df6232a', '7f9df0d1-560f-4e28-99e1-824af12c9d75'],
  ['I', 'c7c99867-6947-43ba-8d5c-6a238a614cf9', 'a3df5fe2-3927-4794-bff8-bbdbb9f145f9'],
  ['I', 'a1fd7e6d-8dea-45fd-9d67-3b6ca513f9eb', '06510944-1590-421b-ba4f-a7bbbfd2f24a'],
  ['F', '3035e7fc-d1be-42fb-bbf4-28f31e596d90', '26b09aec-03b3-4693-b513-ad7558d631ab'],
  ['F', '289f33a5-eeb8-4a1b-a22d-25287478b398', '909f5459-de9d-4690-98dd-338e1a80c4ca'],
].map(([kind, a, b]) => ({ kind, a, b }));

/** Where this browser keeps the answers. */
export const KEY_4 = 'citycrew.dashboard.photoPairs.r4';

/** The kind, as the question above the pair says it. */
export const KIND_NAME = { E: 'Mặt tiền', I: 'Nội thất', F: 'Đồ ăn & uống' };

/** The three answers, and the letter each is written as. "Even" is an
 *  answer, not an abstention: §12 leaves it out of the agreement, and a
 *  forced pick between two equal photographs would count as a miss for
 *  whichever judge chose the other. */
export const CHOICES = [
  { key: 'A', vi: 'A đẹp hơn' },
  { key: '=', vi: 'Ngang nhau' },
  { key: 'B', vi: 'B đẹp hơn' },
];

/** The answers as one line, a letter per pair in order, a dash where there
 *  is none. */
export const encode4 = (answers) => PAIRS_4.map((_, i) => answers[i] ?? '-').join('');

/** Where to pick up: the first pair not yet answered, or the end. */
export function firstOpen4(answers) {
  const i = PAIRS_4.findIndex((_, n) => !answers[n]);
  return i === -1 ? PAIRS_4.length : i;
}
