// Photo labels, round 3: what a photograph is and the six things a cover
// is chosen by, said by a person, to measure Claude's labels against
// (docs/photo-labels.md, step 4).
//
// The 137 photographs are every one the photo-labels skill labelled in
// its trial (17 Oct 2026, 21 places). Claude's answers were written to
// photo_scores before this page existed, and their line is sealed in
// data/review/photo-types/round3.json with its sha256; this page never
// reads them. The order is shuffled (by md5 of the id and a fixed salt) so
// that one place's photographs do not come in a run, where the first
// answer would steer the rest.
//
// As in rounds 1 and 2, the answers stay on the phone that gave them and
// leave it as one line to paste back. Nothing is written to the database.

/** The 137 photographs, in the order they are asked. */
export const SAMPLE_3 = [
  '6cef79f8-b450-487e-8f02-a54538178ed2',
  'b2d52bd7-f05e-48fb-9429-f715776ebdf4',
  'bb0b7640-5ce3-49f5-9742-80613f13143b',
  '053379ac-bcf0-4963-bc47-8a7d52f5c2ca',
  '835b7c70-450d-49e6-b444-c5fb8d71cecd',
  '4e424da9-03f1-4154-861b-508869546c43',
  'f508dbab-a75f-4b1d-a24d-b30a67612b88',
  '92d278dd-b6bb-4d25-a1d9-cc3306e751b3',
  '76df4f3c-aa6e-421f-b74a-22b4b85b0411',
  '24f6fd94-f5bd-4615-9ab3-5b6c69beaf5e',
  '91092061-521d-4d4c-bf29-9608e8f0c099',
  '7cecd732-9212-45b8-aab7-869bb2f11e47',
  'e998b070-506e-4952-b552-3e5bf2043a7f',
  '87d2fb7e-7d4f-4147-a9ba-16c979c26f53',
  '770993c7-9e25-4e10-a770-5270ab49ae4d',
  '4aad806f-2cb2-4e0e-8f41-9d435097c6f3',
  '1185f872-d4df-467b-b5a5-2e115db50ce6',
  '7f82d0c9-8e07-4ff8-b9f5-5521413c21f0',
  '0bdd422d-ab3a-4e74-afd4-f3cea858e44b',
  '3440873d-3c40-4254-a84f-0a69901507d3',
  '2302f5de-e593-438d-ae2f-3c480c74b5d8',
  'f3899ff8-fd62-4a09-90bd-1affddf33eef',
  '52047743-556d-4cea-a7fb-1d962f278db6',
  'b4723598-d018-4a71-87c2-e92389d443f5',
  '0713d222-b13e-41b1-93de-6351d6a74bb2',
  'b62f93d6-3bdc-43fe-927a-5bc3d09ef654',
  'dd386b66-ab07-42bb-b043-f326143a3b04',
  'e56aa951-9b93-4d0d-84af-7d2ab6ad702c',
  '69b68fcd-8790-4fd0-99b8-7f62b71de944',
  '8b4803d1-c238-41fd-96f8-2525a00de68f',
  '1f83ae29-ff5d-4b8b-9610-2cc10f190001',
  '2172b170-393e-4c7c-b16b-be58758097f1',
  '779ed29c-fe0b-4152-8b26-8e38ed8d7f1c',
  '505f92c8-4e58-4410-a668-376ea9bb0728',
  '038d422d-5e01-4a7c-9338-b43a889bd8d1',
  '1ccb5fbc-e8a7-4cf5-ba8b-35a7942ef9f3',
  'c9757630-1596-4e7c-980b-950455f54f84',
  'd437ff1b-2363-4096-bb4a-584e7386fafe',
  '956ec754-5650-43ce-89e3-65f19021b29f',
  '54e826f9-19b3-4e5e-9a5d-78cde44de592',
  '7cdb9cf0-f365-48dc-bfe2-430f83b90558',
  '4dbe2b63-b8ae-42eb-ad5b-423726fa4566',
  '8963f936-3018-47e4-affe-ce527b65160a',
  '42984deb-5883-49a5-a7dc-43bce5f24c2e',
  '142213c6-54db-435a-8cc7-e09fe21ea4d8',
  '145db5af-a6b4-4907-8eec-b9d494e2f7d7',
  '9013553b-4bac-4c17-9aed-a0d1a2ccb024',
  '2e001f79-4ca5-49a1-92ed-d670b8812dc9',
  '7c0e7fc0-19d2-4bd8-8081-38629421cda3',
  'd135ac3b-0a05-4c9f-83be-c02ca0ada013',
  'e076282a-59df-474e-a511-8b90e37a2766',
  '5ba4f913-bfb0-46e5-a440-cde21005fc34',
  '6d75b9ce-5a13-4efb-bd9f-395cadd75fa5',
  '74b798f4-3952-4297-8981-14934f0927a4',
  '1690e162-212b-450c-867d-9264e9efb94f',
  'dcbcdf3c-bbbd-4c65-bc72-6cb6292b3c65',
  '65dca091-47a4-4a0b-8da6-f9552b265354',
  '780c8581-c6f4-467a-b59b-9cb60b35a379',
  '4e20b0c8-d78a-406b-a191-7b27ff144384',
  '12707133-d37b-45b4-97a8-2c8d72477f16',
  'ce592a4c-3d0f-45a5-ab1e-4578940eb2e3',
  'ee2eb1c4-2850-4b1b-ba2b-251922f0eed3',
  '6d1eb616-8422-4ce1-8ee3-cdfccf4f91b0',
  '5021f243-bd43-4e62-bc2f-2f7d19ea5edd',
  'ed9b11af-3b24-4a3a-92fe-03c0572130b0',
  '975d5b8f-674b-47df-8917-69dd15cf7b43',
  '0a003892-5c35-4c94-971d-5a0c25d34de4',
  'e3b67b65-3000-4f8b-b51a-d5791d27d40a',
  'a82c8798-e79d-476f-a728-e0b36fcd55d2',
  '4d69b3da-57b0-40cb-a2f1-173174a8238f',
  'b1acae6c-f1ed-4b20-a044-62ee659ca895',
  '50d4ecba-67e7-4422-8045-2d23b95b8b9a',
  '122568f2-8549-4ce9-9710-6b79df5f610a',
  '333bad8e-73a6-4c2c-b47d-d66b590bee25',
  '10639480-5f59-4b95-ba1f-0f348b188de3',
  'bf9d0033-d6c2-41f1-859d-9b923026703d',
  '550dbabd-585d-415b-9585-8ff816056271',
  'f38e657b-c4ce-42ee-916c-d7221e0bec10',
  'd8399e91-78e7-4bd0-9752-20e1087f02ac',
  'a615b470-a156-4fee-a38b-e48d68cfe0cf',
  'be5d09da-73d5-453d-8fa3-b470f57196ed',
  '1714c98b-f3d5-47fb-9c83-e5ba3df88dc3',
  '3da11d92-f5bc-4d37-9094-8a273ab772cd',
  'b3ba28c1-3ad1-49c7-9fe8-537a2323620d',
  '094ee2b7-74ec-485d-b4d4-7f3401244240',
  'e69232bf-dcef-47b8-8efe-3b4dfe463f26',
  '49a0a65a-0a3b-4f0e-8680-321b13749b93',
  'ab4cfc15-1789-47c5-8dd5-fc35f98d9833',
  'dba6f1b9-89b2-4a70-b3fd-aafc85d52217',
  'b87b606f-0d0e-4909-953f-78a038017845',
  '08bbadae-8051-4a84-a209-0e8b77887061',
  '61e85ec0-c4f2-4d89-b676-c376210698cc',
  'd7592737-6c62-495e-bff0-06c4964b3642',
  '78b7e0e9-b30d-425e-a4de-471d06721082',
  'd413cbf9-5cdf-4908-9122-3313326e6054',
  '5423f655-2642-4102-aaf8-5b24d1e72ca8',
  '5aa5d1b2-fc9f-4cf6-a9b9-d40d6a9d23bf',
  '23e74659-c28b-4495-8438-57e22e3158f3',
  'f02f5868-13c2-486a-9530-6626390183ac',
  'c394613a-3c6f-4e0d-9c38-dff91b93b29d',
  'b1c0c636-196e-487d-a53a-c9de5cd0ad3c',
  '0c25f052-16a5-407e-a405-85a6b34757d4',
  'cd527c8b-5bf9-48c3-bde2-c11595032f78',
  'c96bcf9a-17fe-4eda-8080-fc1aa9f729f6',
  '3fa42286-926c-40f3-b527-a67c65bd7f70',
  'af9ced5d-cb30-4868-b192-675349e03211',
  '3f602190-79ed-4b76-aa67-d3d2b11d3975',
  'd8e8956e-f22c-4b70-94d2-ca26cd562638',
  'fcfc34a4-9fee-4353-8c18-a6f8c8af87f3',
  '11b1c83d-f78e-4a6d-8613-eeea304e82ec',
  '0d45e824-5a9d-4a57-a01e-6bab3c68a1ab',
  '57bf4e0e-b54a-4766-8909-ce4c970f78e0',
  'cd1df386-34d0-454c-9f9e-4fa7a401621d',
  'e581e4ab-abe0-4c60-b7d9-731b54d8f1ff',
  '921b4d58-02b8-482b-a502-fe712f079634',
  'debebf83-2f38-420c-b1bd-4838a09fdb5b',
  'b930d5bc-97c3-4805-b544-2508cc193505',
  'abf41300-efa5-4e6a-a95a-e318df9c4d06',
  '40554e3c-40b4-4ab7-8ab8-285e54d8e19e',
  '54274bd2-4ae3-457e-b90a-3201411a5663',
  'dab9a957-7caa-4a3c-b82e-a6d9b11c6a44',
  '002e21eb-20e7-4d94-b4b9-7d1ef6f6743d',
  '8dd2329e-0b30-46b3-b68e-e4861af25b6d',
  'c4a19f12-a52c-444f-810d-d0f48eee52bf',
  '5608e653-a214-41b9-ac6c-49457701d197',
  'a2853e79-4816-495c-838e-bb24bb6f6fb4',
  '92ef5a44-f6ad-4464-844a-6f738ef9d837',
  'a2e11c3a-b261-45b3-b353-761aec77ec4c',
  'da1f6153-8c3a-434c-b82b-860763101bb9',
  'c570f3e1-e39f-4657-ad20-36c1541e772b',
  '6613a1cc-2b97-41f8-8614-384c257f6baf',
  'a3337395-8f88-4aa9-9bf4-3f913a90ec0d',
  '106c3191-5e6b-4977-a67e-ae80b4cbd2b9',
  '3c1688a2-c938-4e49-b46b-28f5c5b74dd0',
  'a693a748-83aa-4d85-b9bf-e7ae8417d7b2',
  '19e6c266-77d6-46af-9ee5-8262b5f1f207',
  '2405fddd-f041-4b40-bb26-9274428abfd6',
];

/** Round 3b: the six criteria only, on 40 of round 3's photographs. Round
 *  3 measured no criterion — every answer came back at "no", the kind
 *  alone chosen — and the owner chose this over answering all 137 again
 *  (17 Oct 2026). The 40 are drawn by a written rule, so the rare criteria
 *  can be measured at all: every photograph any of the five Claude answers
 *  (the skill, both models under v1 and v2) called people or staged (27),
 *  then photographs where those answers disagree on some criterion, in md5
 *  order, to 40; and the whole shuffled by md5 again. The kinds are
 *  already answered, so the page does not ask them. */
export const SAMPLE_3B = [
  '1714c98b-f3d5-47fb-9c83-e5ba3df88dc3',
  'd7592737-6c62-495e-bff0-06c4964b3642',
  'bf9d0033-d6c2-41f1-859d-9b923026703d',
  'f3899ff8-fd62-4a09-90bd-1affddf33eef',
  'fcfc34a4-9fee-4353-8c18-a6f8c8af87f3',
  '122568f2-8549-4ce9-9710-6b79df5f610a',
  '1f83ae29-ff5d-4b8b-9610-2cc10f190001',
  'a2e11c3a-b261-45b3-b353-761aec77ec4c',
  '3da11d92-f5bc-4d37-9094-8a273ab772cd',
  'b1c0c636-196e-487d-a53a-c9de5cd0ad3c',
  '6d1eb616-8422-4ce1-8ee3-cdfccf4f91b0',
  '770993c7-9e25-4e10-a770-5270ab49ae4d',
  '4aad806f-2cb2-4e0e-8f41-9d435097c6f3',
  '505f92c8-4e58-4410-a668-376ea9bb0728',
  'dab9a957-7caa-4a3c-b82e-a6d9b11c6a44',
  '54e826f9-19b3-4e5e-9a5d-78cde44de592',
  'b62f93d6-3bdc-43fe-927a-5bc3d09ef654',
  'dba6f1b9-89b2-4a70-b3fd-aafc85d52217',
  '0bdd422d-ab3a-4e74-afd4-f3cea858e44b',
  '7cdb9cf0-f365-48dc-bfe2-430f83b90558',
  '094ee2b7-74ec-485d-b4d4-7f3401244240',
  '2172b170-393e-4c7c-b16b-be58758097f1',
  'e3b67b65-3000-4f8b-b51a-d5791d27d40a',
  '956ec754-5650-43ce-89e3-65f19021b29f',
  '4dbe2b63-b8ae-42eb-ad5b-423726fa4566',
  'b930d5bc-97c3-4805-b544-2508cc193505',
  '106c3191-5e6b-4977-a67e-ae80b4cbd2b9',
  'd413cbf9-5cdf-4908-9122-3313326e6054',
  'af9ced5d-cb30-4868-b192-675349e03211',
  '91092061-521d-4d4c-bf29-9608e8f0c099',
  'e56aa951-9b93-4d0d-84af-7d2ab6ad702c',
  '23e74659-c28b-4495-8438-57e22e3158f3',
  'a3337395-8f88-4aa9-9bf4-3f913a90ec0d',
  '2302f5de-e593-438d-ae2f-3c480c74b5d8',
  'be5d09da-73d5-453d-8fa3-b470f57196ed',
  '142213c6-54db-435a-8cc7-e09fe21ea4d8',
  '780c8581-c6f4-467a-b59b-9cb60b35a379',
  'c570f3e1-e39f-4657-ad20-36c1541e772b',
  '57bf4e0e-b54a-4766-8909-ce4c970f78e0',
  '9013553b-4bac-4c17-9aed-a0d1a2ccb024',
];

/** Round 3c: 24 photographs no round has used, asking the kind and the
 *  two criteria round 3b could not settle — wide, under its new name, and
 *  people, under v3. Drawn by the rule in data/review/photo-types/
 *  round3c.json from 60 photographs both models had labelled first, so
 *  that half carry people; their answers were sealed before this page
 *  existed. Every answer here is chosen, none preset: round 3 came back
 *  all "no" because a preset answer cannot be told from a considered one. */
export const SAMPLE_3C = [
  '9c384997-d8d9-4368-9ef7-f9c7755fc225',
  'a575d392-4c56-495e-a463-3d622da4cdce',
  '3efa643b-f452-4abf-a820-f7049819e67c',
  '8362d3df-c577-46d8-8e87-07bb8413b701',
  '3fbad914-c256-4777-8870-07f2f9bea5cd',
  'b11f3c88-b83d-49e6-983b-90f46309c94f',
  '807a7e5f-6903-48aa-a71b-e20250b0a871',
  '681663c0-1ce1-45ce-b538-13632642a3c9',
  'f660388c-c913-4939-8906-3d39808bbe70',
  '3dce9ca2-279a-4822-964a-3a4b1a12d10c',
  '1894cb54-e217-40d6-b407-1bc0e4e50afa',
  '96b1413d-c133-4173-b69b-6a8d668584cf',
  '394c8623-b6a8-4b93-bb9b-5759816988c7',
  '7a47bf0e-4439-41b0-a33c-706e4a25be19',
  'acfbf300-e7c0-40c7-bd7c-3617d0c795a9',
  '81429acc-5acc-40c0-adf4-c8279e778739',
  '878b0257-6182-4912-ae64-82504765eebe',
  'b94ad173-0a36-491a-8bc8-99d5e3b9ecbf',
  '0b45829c-4e06-4da0-a2ac-6657dfe98926',
  'd64a1b98-36ae-467e-91e4-c1e0ae279d8e',
  '506d2388-9194-45d3-94da-94830d6a3e1f',
  '3f4cba20-398d-41b3-8b0e-aec4f70b0e06',
  '04ee0200-97bb-4d15-9a7f-c07f40026bb6',
  '28f920c7-3b6f-4b34-a112-bcfea02b68cd',
];

/** Each round of this page: where its answers are kept, its photographs,
 *  whether it asks the kind, which criteria it asks (all six unless
 *  named), and whether each criterion must be answered outright
 *  (`explicit`) rather than stepped from a preset "no". */
export const ROUNDS_3 = {
  r3: { key: 'citycrew.dashboard.photoLabels.r3', sample: SAMPLE_3, kinds: true },
  r3b: { key: 'citycrew.dashboard.photoLabels.r3b', sample: SAMPLE_3B, kinds: false },
  r3c: { key: 'citycrew.dashboard.photoLabels.r3c', sample: SAMPLE_3C, kinds: true, ask: ['wide', 'people'], explicit: true },
};

/** What the photograph is, and the letter each answer is written as. The
 *  definitions are the skill's (.claude/skills/photo-labels/SKILL.md). */
export const KINDS_3 = [
  { key: 'F', vi: 'Đồ ăn', en: 'Food' },
  { key: 'I', vi: 'Nội thất', en: 'Interior' },
  { key: 'E', vi: 'Mặt tiền', en: 'Exterior' },
  { key: 'V', vi: 'Phong cảnh', en: 'View' },
  { key: 'T', vi: 'Chữ', en: 'Text' },
  { key: 'O', vi: 'Khác', en: 'Other' },
  { key: 'U', vi: 'Không chắc', en: 'Not sure' },
];

/** The six cover criteria, in the order they are written in the line. */
export const ATTRS = [
  { key: 'brand', vi: 'Biển hiệu', hint: 'Biển hay tên của chính quán đọc được. Logo in trên cốc, đĩa, phin không tính' },
  { key: 'wide', vi: 'Thấy cả không gian', hint: 'Thấy cả phòng, cả mặt tiền hay cả sân, không phải cận một món hay một góc' },
  { key: 'green', vi: 'Cây xanh', hint: 'Cây hay cây lá chiếm một phần đáng kể. Hoa, bình hoa, vài chậu nhỏ không tính' },
  { key: 'daylight', vi: 'Ánh sáng ngày', hint: 'Sáng chủ yếu nhờ trời: nắng, trời râm, cửa sổ. Đèn hay ban đêm là Không' },
  { key: 'people', vi: 'Người', hint: 'Thấy bất kỳ người nào trong ảnh: khách, barista, người qua đường. Chỉ một bàn tay thì không tính' },
  { key: 'staged', vi: 'Dàn dựng', hint: 'Có người mẫu tạo dáng cho ảnh. Chữ in đè lên ảnh không tính' },
];

/** An attribute's answer, and the next one a tap moves it to. "No" first,
 *  because most photographs are no on most of the six (in the trial, people
 *  was yes on 6 of 137 and brand on 22): one tap per yes, two for "can't
 *  tell". The cost is that an attribute nobody looked at reads as no, so
 *  the round is scored by agreement on the yeses (kappa), not by raw
 *  agreement, which "no" everywhere would win. */
export const STATES = [
  { key: '0', vi: 'Không' },
  { key: '1', vi: 'Có' },
  { key: '?', vi: 'Không rõ' },
];
export const nextState = (s) => STATES[(STATES.findIndex((x) => x.key === s) + 1) % STATES.length].key;

/** The definitions of the kinds, shown folded under the photograph. */
export const GUIDE_3 = [
  'Xét theo chủ thể: thứ chiếm phần lớn khung và được lấy nét, không xét ảnh có trời hay cây.',
  'Đồ ăn: đồ ăn, đồ uống là chủ thể, kể cả khi phía sau có view.',
  'Nội thất: bên trong quán: phòng, bàn ghế, quầy, kệ, cầu thang. Có người trong quán vẫn là Nội thất.',
  'Mặt tiền: nơi chốn nhìn từ ngoài: mặt tiền, lối vào, biển hiệu, toà nhà, hiên như một phần toà nhà. Nhà thờ, bảo tàng dưới trời xanh vẫn là Mặt tiền.',
  'Phong cảnh: cảnh vật là chủ thể: trời, nước, cây, toàn cảnh thành phố. Vườn hay công viên chính là nơi chốn, chụp như phong cảnh, là Phong cảnh.',
  'Chữ: menu, bảng, poster: thứ để đọc hơn là để nhìn.',
  'Khác: chân dung cận, một vật không thấy nơi chốn, ảnh hỏng.',
];

/** The criteria a round asks, in the line's order. */
export const asked = (r) => ATTRS.filter((x) => !r.ask || r.ask.includes(x.key));

/** Whether a photograph has been answered: a kind where the round asks
 *  one, and otherwise Next pressed on it (`seen`), since a photograph whose
 *  six answers are all "no" looks the same answered or not; and in an
 *  explicit round, every criterion it asks. */
const answered = (a, r) => (r.kinds ? !!a?.kind : !!a?.seen)
  && (!r.explicit || asked(r).every((x) => a?.attrs?.[x.key]));

/** An answer as the line writes it: the kind's letter where the round asks
 *  one, then the criteria it asks, e.g. `I010100`, `010100` or `I10`;
 *  dashes where there is no answer. A criterion left alone is "no" in a
 *  stepped round and cannot be left alone in an explicit one. */
export const code = (a, r = ROUNDS_3.r3) => {
  const attrs = asked(r);
  if (!answered(a, r)) return '-'.repeat((r.kinds ? 1 : 0) + attrs.length);
  return (r.kinds ? a.kind : '') + attrs.map((x) => a.attrs?.[x.key] ?? '0').join('');
};

/** The answers as one line, a code per photograph in sample order. */
export const encode3 = (sample, answers, r = ROUNDS_3.r3) => sample.map((id) => code(answers[id], r)).join(' ');

/** Where to pick up: the first photograph not yet answered, or the end. */
export function firstOpen3(sample, answers, r = ROUNDS_3.r3) {
  const i = sample.findIndex((id) => !answered(answers[id], r));
  return i === -1 ? sample.length : i;
}
