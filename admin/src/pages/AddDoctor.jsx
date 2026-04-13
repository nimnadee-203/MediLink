import React from 'react';
import { assets } from '../assets/assets.js';

const AddDoctor = () => {
  return (
    <form className="add-doctor-wrapper">
      <h2 className="add-doctor-title">Add Doctor</h2>

      <div className="add-doctor-container">
        <div className="upload-section">
          <label htmlFor="doc-img" className="upload-label">
            <img src={assets.upload_area} alt="Upload" />
          </label>
          <input type="file" id="doc-img" hidden />
          <p className="upload-text">
            Upload doctor <br /> picture
          </p>
        </div>

        <div className="doctor-form-grid">
          <div className="form-item">
            <p>Doctor Name</p>
            <input type="text" placeholder="Name" required />
          </div>

          <div className="form-item">
            <p>Speciality</p>
            <select name="speciality" required>
              <option value="" disabled selected>Select Speciality</option>
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
            <input type="email" placeholder="Email" required />
          </div>

          <div className="form-item">
            <p>Education</p>
            <input type="text" placeholder="Education" required />
          </div>

          <div className="form-item">
            <p>Doctor Password</p>
            <input type="password" placeholder="Password" required />
          </div>

          <div className="form-item">
            <p>Address</p>
            <input type="text" placeholder="Address" required />
          </div>

          <div className="form-item">
            <p>Experience</p>
            <select name="experience" required>
              <option value="" disabled selected>Select Experience</option>
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
            <input type="number" placeholder="Fee" required />
          </div>
        </div>

        <div className="form-item about-section">
          <p>About Doctor</p>
          <textarea placeholder="Write about doctor" rows={5} required />
        </div>

        <button type="submit" className="submit-btn">
          Add Doctor
        </button>
      </div>
    </form>
  );
};

export default AddDoctor;

