export const customerFixtures = {
  phones: {
    local: "01012345678",
    e164: "+201012345678",
    international: "00201012345678",
  },
  names: ["أحمد", "احمد", "مدرسة", "مدرسه", "فتى", "فتي"],
  classifications: ["Individual", "Company", "Agency", "VIP"],
};

export function makeCustomerInput(index = 0) {
  return { name: `عميل ${index}`, primaryPhone: `010${String(index).padStart(8, "0")}` };
}
