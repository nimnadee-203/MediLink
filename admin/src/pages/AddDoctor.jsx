import React, { useContext, useState } from 'react';
import { assets } from '../assets/assets.js';
import { AdminContext } from '../context/AdminContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const AddDoctor = () => {
  const [docImg, setDocImg] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [experience, setExperience] = useState('1 Year');
  const [fees, setFees] = useState('');
  const [about, setAbout] = useState('');
  const [speciality, setSpeciality] = useState('General Physician');
  const [degree, setDegree] = useState('');
  const [address, setAddress] = useState('');
  const [consultationMode, setConsultationMode] = useState('in_person_only');

  const { backendUrl, aToken } = useContext(AdminContext);

  const onSubmitHandler = async (event) => {
    event.preventDefault();

    try {
      if (!docImg) {
        return toast.error('Image Not Selected');
      }

      const formData = new FormData();
      formData.append('image', docImg);
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('experience', experience);
      formData.append('fees', Number(fees));
      formData.append('about', about);
      formData.append('speciality', speciality);
      formData.append('degree', degree);
      formData.append('address', address);
      formData.append('available', true); // Default available
      formData.append('status', 'approved'); // satisfy backend validation
      formData.append('consultationMode', consultationMode);

      const { data } = await axios.post(backendUrl + '/api/admin/add-doctor', formData, {
        headers: { atoken: aToken }
      });

      if (data.success) {
        toast.success(data.message);
        // Reset Form
        setDocImg(false);
        setName('');
        setEmail('');
        setPassword('');
        setAddress('');
        setDegree('');
        setFees('');
        setAbout('');
        setConsultationMode('in_person_only');
      } else {
        toast.error(data.message);
      }

    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      console.log(error);
    }
  };

  return (
    <form onSubmit={onSubmitHandler} className="add-doctor-wrapper">
      <h2 className="add-doctor-title">Add Doctor</h2>

      <div className="add-doctor-container">
        <div className="upload-section">
          <label htmlFor="doc-img" className="upload-label">
            <img 
              src={docImg ? URL.createObjectURL(docImg) : assets.upload_area} 
              alt="Upload" 
            />
          </label>
          <input 
            onChange={(e) => setDocImg(e.target.files[0])} 
            type="file" 
            id="doc-img" 
            hidden 
          />
          <p className="upload-text">
            Upload doctor <br /> picture
          </p>
        </div>

        <div className="doctor-form-grid">
          <div className="form-item">
            <p>Doctor Name</p>
            <input 
              onChange={(e) => setName(e.target.value)} 
              value={name} 
              type="text" 
              placeholder="Name" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Speciality</p>
            <select 
              onChange={(e) => setSpeciality(e.target.value)} 
              value={speciality} 
              name="speciality" 
              required
            >
              <option value="General Physician">General Physician</option>
              <option value="Gynecologist">Gynecologist</option>
              <option value="Dermatologist">Dermatologist</option>
              <option value="Pediatricians">Pediatricians</option>
              <option value="Neurologist">Neurologist</option>
              <option value="Gastroenterologist">Gastroenterologist</option>
            </select>
          </div>

          <div className="form-item">
            <p>Doctor Email</p>
            <input 
              onChange={(e) => setEmail(e.target.value)} 
              value={email} 
              type="email" 
              placeholder="Email" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Degree</p>
            <input 
              onChange={(e) => setDegree(e.target.value)} 
              value={degree} 
              type="text" 
              placeholder="Degree" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Doctor Password</p>
            <input 
              onChange={(e) => setPassword(e.target.value)} 
              value={password} 
              type="password" 
              placeholder="Password" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Address</p>
            <input 
              onChange={(e) => setAddress(e.target.value)} 
              value={address} 
              type="text" 
              placeholder="Address" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Experience</p>
            <select 
              onChange={(e) => setExperience(e.target.value)} 
              value={experience} 
              name="experience" 
              required
            >
              <option value="1 Year">1 Year</option>
              <option value="2 Year">2 Year</option>
              <option value="3 Year">3 Year</option>
              <option value="4 Year">4 Year</option>
              <option value="5 Year">5 Year</option>
              <option value="6 Year">6 Year</option>
              <option value="7 Year">7 Year</option>
              <option value="8 Year">8 Year</option>
              <option value="9 Year">9 Year</option>
              <option value="10 Year">10 Year</option>
            </select>
          </div>

          <div className="form-item">
            <p>Fees</p>
            <input 
              onChange={(e) => setFees(e.target.value)} 
              value={fees} 
              type="number" 
              placeholder="Fee" 
              required 
            />
          </div>

          <div className="form-item">
            <p>Consultation Mode</p>
            <select
              onChange={(e) => setConsultationMode(e.target.value)}
              value={consultationMode}
              name="consultationMode"
              required
            >
              <option value="in_person_only">In-person only</option>
              <option value="both">In-person + Telemedicine</option>
            </select>
          </div>
        </div>

        <div className="form-item about-section">
          <p>About Doctor</p>
          <textarea 
            onChange={(e) => setAbout(e.target.value)} 
            value={about} 
            placeholder="Write about doctor" 
            rows={5} 
            required 
          />
        </div>

        <button type="submit" className="submit-btn">
          Add Doctor
        </button>
      </div>
    </form>
  );
};

export default AddDoctor;

