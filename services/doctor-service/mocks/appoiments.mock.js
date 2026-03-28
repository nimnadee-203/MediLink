const mockAppointments = [
  {
    _id: "1",
    userId: "1",
    docId: "1",
    slotDate: "2026-03-28",
    slotTime: "10:00 AM",

    userData: {
      name: "Shanuka Yasanga",
      email: "shanuka@gmail.com",
      phone: "0771234567"
    },

    docData: {
      name: "Dr. John Silva",
      speciality: "Cardiologist",
      fees: 2000
    },

    amount: 2000,
    date: Date.now(),

    cancelled: false,
    payment: false,
    isCompleted: false
  },

  {
    _id: "2",
    userId: "2",
    docId: "2",
    slotDate: "2026-03-29",
    slotTime: "2:00 PM",

    userData: {
      name: "Nimal Perera",
      email: "nimal@gmail.com",
      phone: "0779876543"
    },

    docData: {
      name: "Dr. Nimal Perera",
      speciality: "Dermatologist",
      fees: 1500
    },

    amount: 1500,
    date: Date.now(),

    cancelled: false,
    payment: true,
    isCompleted: false
  }
];

export default mockAppointments;