import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminContext } from '../context/AdminContext';
import { toast } from 'react-toastify';
import { assets } from '../assets/assets';

const DoctorProfile = () => {
    const { docId } = useParams();
    const navigate = useNavigate();
    const { doctors, getAllDoctors, updateDoctor, deleteDoctor, aToken } = useContext(AdminContext);

    const [isEditing, setIsEditing] = useState(false);
    const [docData, setDocData] = useState(null);
    const [tempImg, setTempImg] = useState(false);

    // Form States
    const [name, setName] = useState('');
    const [speciality, setSpeciality] = useState('');
    const [degree, setDegree] = useState('');
    const [experience, setExperience] = useState('');
    const [fees, setFees] = useState('');
    const [address, setAddress] = useState('');
    const [about, setAbout] = useState('');
    const [available, setAvailable] = useState(true);

    const fetchDocInfo = () => {
        const doc = doctors.find(d => d._id === docId);
        if (doc) {
            setDocData(doc);
            setName(doc.name);
            setSpeciality(doc.speciality);
            setDegree(doc.degree);
            setExperience(doc.experience);
            setFees(doc.fees);
            setAddress(doc.address);
            setAbout(doc.about);
            setAvailable(doc.available);
        }
    };

    useEffect(() => {
        if (aToken) {
            if (doctors.length === 0) {
                getAllDoctors();
            } else {
                fetchDocInfo();
            }
        }
    }, [aToken, doctors, docId]);

    const handleUpdate = async () => {
        const formData = new FormData();
        formData.append('docId', docId);
        formData.append('name', name);
        formData.append('speciality', speciality);
        formData.append('degree', degree);
        formData.append('experience', experience);
        formData.append('fees', fees);
        formData.append('address', address);
        formData.append('about', about);
        formData.append('available', available);
        formData.append('status', docData?.status || 'approved');

        if (tempImg) {
            formData.append('image', tempImg);
        }

        const success = await updateDoctor(formData);
        if (success) {
            setTempImg(false);
            setIsEditing(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this doctor? This action cannot be undone.")) {
            const success = await deleteDoctor(docId);
            if (success) {
                navigate('/doctors');
            }
        }
    };

    if (!docData) {
        return <div className="p-10">Loading doctor profile...</div>;
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Doctor Profile</h2>
            
            <div className="doctor-profile-container">
                <div className="profile-header">
                    <div className="profile-img-container">
                        <img 
                            className="profile-img" 
                            src={tempImg ? URL.createObjectURL(tempImg) : docData.image} 
                            alt={docData.name} 
                        />
                        <label htmlFor="profile-upload" className="img-edit-overlay">
                            Change Photo
                        </label>
                        <input 
                            type="file" 
                            id="profile-upload" 
                            hidden 
                            onChange={(e) => setTempImg(e.target.files[0])} 
                        />
                    </div>
                    <div className="profile-title-section">
                        <p className="profile-name">{docData.name}</p>
                        <p className="profile-speciality">{docData.speciality}</p>
                        <p className="profile-status">
                            {docData.available ? '● Active' : '○ Inactive'}
                        </p>
                    </div>
                </div>

                <div className="profile-grid">
                    <div className="profile-item">
                        <label>Doctor Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                        />
                    </div>

                    <div className="profile-item">
                        <label>Speciality</label>
                        <select value={speciality} onChange={(e) => setSpeciality(e.target.value)}>
                            <option value="General Physician">General Physician</option>
                            <option value="Gynecologist">Gynecologist</option>
                            <option value="Dermatologist">Dermatologist</option>
                            <option value="Pediatricians">Pediatricians</option>
                            <option value="Neurologist">Neurologist</option>
                            <option value="Gastroenterologist">Gastroenterologist</option>
                        </select>
                    </div>

                    <div className="profile-item">
                        <label>Degree / Education</label>
                        <input 
                            type="text" 
                            value={degree} 
                            onChange={(e) => setDegree(e.target.value)} 
                        />
                    </div>

                    <div className="profile-item">
                        <label>Experience</label>
                        <select value={experience} onChange={(e) => setExperience(e.target.value)}>
                            {[...Array(10)].map((_, i) => (
                                <option key={i} value={`${i + 1} Year`}>{i + 1} Year</option>
                            ))}
                        </select>
                    </div>

                    <div className="profile-item">
                        <label>Appointment Fees ($)</label>
                        <input 
                            type="number" 
                            value={fees} 
                            onChange={(e) => setFees(e.target.value)} 
                        />
                    </div>

                    <div className="profile-item">
                        <label>Address</label>
                        <input 
                            type="text" 
                            value={address} 
                            onChange={(e) => setAddress(e.target.value)} 
                        />
                    </div>

                    <div className="profile-item profile-about">
                        <label>About Doctor</label>
                        <textarea 
                            rows={4} 
                            value={about} 
                            onChange={(e) => setAbout(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="profile-actions">
                    <button className="save-btn" onClick={handleUpdate}>
                        Save Changes
                    </button>
                    <button className="cancel-btn" onClick={() => navigate('/doctors')}>
                        Cancel
                    </button>
                    <button className="delete-btn" onClick={handleDelete}>
                        Delete Doctor
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DoctorProfile;
