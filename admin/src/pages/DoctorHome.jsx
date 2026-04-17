<div className="doctor-chart-header">
  <h3>Upcoming Appointments</h3>
  <p>Chronological patient queue</p>
</div>

{loading ? (
  <p className="text-muted">Loading appointments...</p>
) : error ? (
  <p className="error-text">{error}</p>
) : upcomingAppointments.length === 0 ? (
  <p className="text-muted">No upcoming appointments found.</p>
) : (
  <>
    {actionError && <p className="error-text">{actionError}</p>}
    {actionMessage && <p className="success-text">{actionMessage}</p>}
    {sessionError && !liveAppointmentId && <p className="error-text">{sessionError}</p>}

    <ul>
      {upcomingAppointments.map((apt) => (
        <li
          key={apt._id}
          className="doctor-home-appointment-item clickable"
          onClick={() => viewAppointmentDetails(apt._id)}
        >
          <div>
            <strong>{formatTime12h(apt.slotTime)}</strong>
            <span>
              {formatDate(apt.slotDate)} · Rs. {Number(apt.amount || 0).toLocaleString()}
            </span>
          </div>

          <div>
            <span className={`visit-mode-chip ${apt.visitMode === 'telemedicine' ? 'telemedicine' : 'inperson'}`}>
              {apt.visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'}
            </span>

            <span className={`status-chip ${apt.status}`}>{apt.status}</span>

            <small>{apt.patientName || `Patient #${String(apt.patientId).slice(-6)}`}</small>

            {apt.visitMode === 'telemedicine' && (
              <button
                type="button"
                className="join-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  joinTelemedicine(apt);
                }}
                disabled={joiningAppointmentId === apt._id}
              >
                {joiningAppointmentId === apt._id ? 'Joining...' : 'Join Jitsi'}
              </button>
            )}

            <div className="doctor-row-actions">
              <button
                type="button"
                className="row-action-btn view"
                onClick={(e) => {
                  e.stopPropagation();
                  viewAppointmentDetails(apt._id);
                }}
                disabled={detailsLoadingId === apt._id}
              >
                {detailsLoadingId === apt._id ? 'Loading...' : 'View'}
              </button>

              <button
                type="button"
                className="row-action-btn approve"
                onClick={(e) => {
                  e.stopPropagation();
                  runAppointmentAction(apt._id, 'approve');
                }}
                disabled={actionLoadingId === `${apt._id}approve` || !['pending', 'confirmed'].includes(apt.status)}
              >
                {actionLoadingId === `${apt._id}approve` ? 'Approving...' : 'Approve'}
              </button>

              {/* ✅ KEEP THIS (from feature branch) */}
              <button
                type="button"
                className="row-action-btn approve"
                onClick={(e) => {
                  e.stopPropagation();
                  runAppointmentAction(apt._id, 'complete');
                }}
                disabled={actionLoadingId === `${apt._id}complete` || apt.status !== 'confirmed'}
              >
                {actionLoadingId === `${apt._id}complete` ? 'Completing...' : 'Mark Completed'}
              </button>

              <button
                type="button"
                className="row-action-btn cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  runAppointmentAction(apt._id, 'cancel');
                }}
                disabled={actionLoadingId === `${apt._id}cancel` || !['pending', 'confirmed'].includes(apt.status)}
              >
                {actionLoadingId === `${apt._id}cancel` ? 'Cancelling...' : 'Cancel'}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
)}