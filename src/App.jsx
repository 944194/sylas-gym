

import { useEffect, useRef, useState } from 'react'

import { gsap } from 'gsap'

import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { GYM_CONFIG } from './config'

import { ArrowDown, ArrowRight, Menu, X, Images } from 'lucide-react'

import './App.css'



gsap.registerPlugin(ScrollTrigger)







function App() {

  const heroRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)

  const [activePhoto, setActivePhoto] = useState(null)



  const [trainers, setTrainers] = useState([]);

  const [trainersLoading, setTrainersLoading] = useState(true);

  const [trainersError, setTrainersError] = useState("");



    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')



  // These are illustrative gym photos. Replace with approved Sylas Gym photos when available.

  const galleryPhotos = [

    { src: '/gym-gallery/gym-interior.jpg', alt: 'Main gym floor with strength machines', label: 'THE TRAINING FLOOR' },

    { src: '/gym-gallery/cardio-treadmills.jpg', alt: 'Cardio zone with treadmills', label: 'CARDIO ZONE' },

    { src: '/gym-gallery/cardio-equipment.jpg', alt: 'Treadmills and cardio equipment', label: 'MOVE WITH PURPOSE' },

    { src: '/gym-gallery/dumbbell-rack.jpg', alt: 'Dumbbell rack and mirrored workout area', label: 'STRENGTH ZONE' },

    { src: '/gym-gallery/treadmill-area.jpg', alt: 'Treadmill and machine area', label: 'CARDIO & CONDITIONING' },

    { src: '/gym-gallery/functional-training.jpg', alt: 'Cardio and functional training equipment', label: 'TRAIN EVERY DAY' },

    { src: '/gym-gallery/dumbbells.jpg', alt: 'Dumbbells for strength training', label: 'EVERY REP COUNTS' },

    { src: '/gym-gallery/strength-zone.jpg', alt: 'Strength zone and plate-loaded machines', label: 'BUILT FOR PROGRESS' },

    { src: '/gym-gallery/cardio-zone.jpg', alt: 'Cardio zone with large windows', label: 'FIND YOUR PACE' },

    { src: '/gym-gallery/gym-wide-view.jpg', alt: 'Wide view of the Sylas Gym floor', label: 'YOUR NEXT CHAPTER' },

];





  useEffect(() => {
    const ctx = gsap.context(() => {
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      const mobile = window.matchMedia('(max-width: 640px)').matches;

      if (reduceMotion) return;

      gsap.from('.nav-item', {
        y: -16,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
      });

      gsap.from(
        '.hero-tag, .hero-title, .hero-description, .hero-actions',
        {
          y: mobile ? 18 : 35,
          opacity: 0,
          duration: 0.8,
          stagger: 0.14,
          delay: 0.15,
          ease: 'power3.out',
        }
      );

      gsap.from('.hero-image', {
        scale: mobile ? 1.03 : 1.1,
        opacity: 0.6,
        duration: 1.3,
        ease: 'power2.out',
      });

      gsap.utils.toArray([
        '.intro-section',
        '.training-section',
        '.trainers-section',
        '.contact-section',
        '.gallery-section',
        '.owner-section',
        '.timetable-section',
      ]).forEach((section) => {
        const content = section.querySelectorAll(
          '.section-kicker, h2, p, .button-primary'
        );
        gsap.from(content, {
          y: mobile ? 14 : 30,
          opacity: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            once: true,
          },
        });
      });

      if (!mobile) {
        gsap.to('.hero-image', {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPublicTrainers = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/trainers`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error('Unable to load trainers.');
        }

        if (!cancelled) {
          setTrainers(data.trainers || []);
          setTrainersError('');
        }
      } catch (error) {
        if (!cancelled) {
          setTrainersError('Trainer profiles are temporarily unavailable.');
        }
      } finally {
        if (!cancelled) {
          setTrainersLoading(false);
        }
      }
    };

    loadPublicTrainers();
    return () => {
      cancelled = true;
    };
  }, []);


  const closeMenu = () => setMenuOpen(false)



  return (

    <main ref={heroRef} className="site-shell">

      <nav className="navbar">

        <a className="brand nav-item" href="#home" onClick={closeMenu}>

  <img

    className="brand-logo"

    src="/images/sylas-gym-logo.png"

    alt="AURAFIT Gym logo"

  />

  <span className="brand-name">

    AURAFIT <span className="brand-accent">GYM</span>

    <small>TRAIN WITH PURPOSE</small>

  </span>

</a>



        <div className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}>

          <a className="nav-item" href="#home" onClick={closeMenu}>HOME</a>

          <a className="nav-item" href="#about" onClick={closeMenu}>ABOUT</a>

          <a className="nav-item" href="#training" onClick={closeMenu}>TRAINING</a>

          <a className="nav-item gallery-nav-link" href="#gallery" onClick={closeMenu}>GALLERY</a>

          <a className="nav-item" href="#owner" onClick={closeMenu}>OWNER</a>

          <a className="nav-item" href="#timetable" onClick={closeMenu}>TIMETABLE</a>

          <a className="nav-item" href="#contact" onClick={closeMenu}>CONTACT</a>

          <a className="nav-item login-nav-link" href="/login" onClick={closeMenu}>LOGIN</a>

          <a className="mobile-join" href="#contact" onClick={closeMenu}>JOIN NOW ↗</a>

        </div>



        <a className="nav-cta nav-item" href="#contact">

          JOIN NOW <ArrowRight size={16} />

        </a>



        <button

          className="menu-toggle"

          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}

          aria-expanded={menuOpen}

          onClick={() => setMenuOpen(!menuOpen)}

        >

          {menuOpen ? <X /> : <Menu />}

        </button>

      </nav>



      <section className="hero" id="home">

        <div className="hero-image" />



        <div className="hero-content">

          <p className="hero-tag">

            <span /> YOUR JOURNEY. YOUR STRENGTH.

          </p>



          <h1 className="hero-title">

            BUILT BY

            <br />

            <span>DISCIPLINE.</span>

            <br />

            DEFINED BY

            <br />

            <span className="outline-text">STRENGTH.</span>

          </h1>



          <p className="hero-description">

            Every rep has a purpose. Every day is an opportunity

            to become stronger. Start your journey at Sylas Gym.

          </p>



          <div className="hero-actions">

            <a href="#contact" className="button-primary">

              START YOUR JOURNEY <ArrowRight size={18} />

            </a>

            <a href="#about" className="button-secondary">

              DISCOVER SYLAS <ArrowDown size={17} />

            </a>

          </div>

        </div>



        <div className="hero-bottom">

          <span>BORABANDA · HYDERABAD</span>

          <span className="hero-index">01 / 03</span>

          <a href="#about">SCROLL TO EXPLORE ↓</a>

        </div>



        <div className="hero-side-label">STRENGTH · FOCUS · CONSISTENCY</div>

      </section>



      <section className="intro-section" id="about">

        <p className="section-kicker">01 — THE MINDSET</p>

        <h2>

          STRONGER ISN'T GIVEN.

          <br />

          <span>IT'S EARNED.</span>

        </h2>

        <p className="intro-copy">

          Show up. Put in the work. Keep moving forward.

          Your fitness journey starts with one decision.

        </p>

      </section>





<section className="training-section" id="training">

  <div className="training-heading">

    <div>

      <p className="section-kicker">02 — TRAIN WITH PURPOSE</p>

      <h2>

        FIND YOUR

        <br />

        <span>STRENGTH.</span>

      </h2>

    </div>

    <p className="training-intro">

      Every journey is different. Find the training approach

      that works for your goals.

    </p>

  </div>



  <div className="training-grid">

    <article className="training-card">

      <img

        src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80"

        alt="Strength training with weights"

        loading="lazy"

      />

      <div className="training-card-content">

        <span>01 / BUILD</span>

        <h3>STRENGTH TRAINING</h3>

        <p>Build strength through consistent, focused training.</p>

      </div>

    </article>



    <article className="training-card">

      <img

        src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80"

        alt="Gym equipment and training area"

        loading="lazy"

      />

      <div className="training-card-content">

        <span>02 / MOVE</span>

        <h3>FITNESS & CONDITIONING</h3>

        <p>Work towards better fitness, movement, and endurance.</p>

      </div>

    </article>



    <article className="training-card">

      <img

        src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80"

        alt="Athlete training in a gym"

        loading="lazy"

      />

      <div className="training-card-content">

        <span>03 / PROGRESS</span>

        <h3>YOUR FITNESS JOURNEY</h3>

        <p>Take the first step and work consistently towards your goals.</p>

      </div>

    </article>

  </div>



  <a href="#contact" className="button-primary training-cta">

    ENQUIRE ABOUT MEMBERSHIP <ArrowRight size={18} />

  </a>

</section>







<section className="trainers-section" id="trainers">

  <div className="trainers-heading">

    <p className="section-kicker">MEET THE TEAM</p>

    <h2>OUR TRAINERS</h2>

    <p>Experienced coaches to support your fitness journey.</p>

  </div>



  {trainersLoading ? (

    <p className="trainers-message">Loading trainers...</p>

  ) : trainersError ? (

    <p className="trainers-message" role="status">{trainersError}</p>

  ) : trainers.length === 0 ? (

    <p className="trainers-message">

      Our trainer profiles will be available soon.

    </p>

  ) : (

    <div className="trainers-grid">

      {trainers.map((trainer) => (

        <article className="trainer-card" key={trainer.id}>

          <div className="trainer-image-wrap">

            <img

              src={trainer.image_url}

              alt={`${trainer.name} — ${trainer.specialization}`}

              loading="lazy"

            />

          </div>



          <div className="trainer-card-content">

            <h3>{trainer.name}</h3>

            <p className="trainer-specialization">

              {trainer.specialization}

            </p>



            <p className="trainer-experience">

              {trainer.experience_years} years of experience

            </p>



            {trainer.qualifications && (

              <p className="trainer-qualifications">

                {trainer.qualifications}

              </p>

            )}



            {trainer.bio && <p className="trainer-bio">{trainer.bio}</p>}

          </div>

        </article>

      ))}

    </div>

  )}

</section>









      <section className="gallery-section" id="gallery">

        <div className="gallery-heading">

          <div>

            <p className="section-kicker">03 — INSIDE AURAFIT</p>

            <h2>THE SPACE.<br /><span>THE WORK.</span></h2>

          </div>

          <p className="gallery-intro">

            Take a look inside Sylas Gym — from strength equipment to the cardio zone.

          </p>

        </div>



        <div className="gallery-marquee" aria-label="Sylas Gym photo highlights">

          <div className="gallery-marquee-track">

            {[...galleryPhotos, ...galleryPhotos].map((photo, index) => (

              <button

                className="marquee-photo"

                key={`${photo.label}-${index}`}

                type="button"

                onClick={() => setActivePhoto(photo)}

                aria-label={`View photo: ${photo.label}`}

                tabIndex={index >= galleryPhotos.length ? -1 : 0}

              >

                <img src={photo.src} alt={index < galleryPhotos.length ? photo.alt : ''} loading="lazy" />

                <span>{photo.label}</span>

              </button>

            ))}

          </div>

        </div>

        <p className="gallery-note">Select any photo to view it larger.</p>

      </section>



      <section className="owner-section" id="owner">

        <div className="owner-copy">

          <p className="section-kicker">04 — THE PEOPLE BEHIND SYLAS</p>

          <h2>MORE THAN A GYM.<br /><span>A COMMUNITY.</span></h2>

          <p>

            Established on February 10, 2020, Sylas Gym was built to be more than

            a fitness facility — a community where people can work towards their

            goals, stay consistent and become stronger together.

          </p>

          <p>

            Every member is part of the Sylas family. Show up, put in the work,

            and keep moving forward.

          </p>

        </div>

        <article className="owner-card">

          <img

            src="/gym-gallery/owner-ajith-paul-syla.jpg"

            alt="Ajith Paul Syla, proprietor of Sylas Gym"

            loading="lazy"

          />

          <div className="owner-card-info">

            <span className="owner-label">THE PROPRIETOR</span>

            <h3>Ajith Paul Syla</h3>

            <p>Proprietor, Sylas Gym</p>

          </div>

        </article>

      </section>







      <section className="contact-section" id="contact">

  <div className="contact-layout">

    <div className="contact-info">

      <p className="section-kicker">04 — TAKE THE FIRST STEP</p>



      <h2>

        YOUR STRONGER

        <br />

        SELF STARTS <span>HERE.</span>

      </h2>



      <p className="contact-description">

        Ready to begin your fitness journey? Contact Sylas Gym

        to ask about membership and visit the gym.

      </p>



      <div className="contact-details">

        <div className="contact-detail">

          <span>LOCATION</span>

          <p>{GYM_CONFIG.location}</p>

        </div>



        <div className="contact-detail">

          <span>PHONE</span>

          <p>{GYM_CONFIG.phoneDisplay}</p>

        </div>

      </div>



      <div className="contact-actions">

        <a

          className="button-primary"

          href={`tel:${GYM_CONFIG.phoneDisplay}`}

        >

          <span>CALL THE GYM</span>

          <ArrowRight size={18} />

        </a>



        <a

          className="button-secondary"

          href={GYM_CONFIG.mapsUrl}

          target="_blank"

          rel="noreferrer"

        >

          GET DIRECTIONS <ArrowRight size={18} />

        </a>



        <a

          className="button-secondary"

          href={`https://wa.me/${GYM_CONFIG.phoneLink}?text=${encodeURIComponent(

            'Hi, I would like to enquire about Sylas Gym membership.'

          )}`}

          target="_blank"

          rel="noreferrer"

        >

          WHATSAPP ENQUIRY <ArrowRight size={18} />

        </a>

      </div>

    </div>





<form

  className="membership-form"

  onSubmit={async (event) => {

    event.preventDefault();



    const form = event.currentTarget;

    const formData = new FormData(form);



    const memberName = String(formData.get("name") || "").trim();

    const memberPhone = String(formData.get("phone") || "").trim();

    const goal = String(formData.get("goal") || "");



    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;

    submitButton.textContent = "SENDING...";



    try {

      const response = await fetch(

        `${apiUrl}/api/enquiries`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            name: memberName,

            phone: memberPhone,

            membership: goal,

            message: "",

          }),

        }

      );



      const result = await response.json();



      if (!response.ok || !result.success) {

        throw new Error(result.message || "Could not submit enquiry.");

      }



      alert("Thank you! Your membership enquiry was received.");

      form.reset();

    } catch (error) {

      console.error("Enquiry submission failed:", error);

      alert(

        "Unable to submit your enquiry. Please try again later."

      );

    } finally {

      submitButton.disabled = false;

      submitButton.textContent = "SEND MEMBERSHIP ENQUIRY";

    }

  }}

>

  <p className="section-kicker">MEMBERSHIP ENQUIRY</p>

  <h3>LET'S GET STARTED.</h3>



  <label htmlFor="member-name">Your name</label>

  <input

    id="member-name"

    name="name"

    type="text"

    placeholder="Enter your name"

    autoComplete="name"

    required

    maxLength={100}

  />



  <label htmlFor="member-phone">Your phone number</label>

  <input

    id="member-phone"

    name="phone"

    type="tel"

    placeholder="Enter your phone number"

    autoComplete="tel"

    pattern="[0-9+\s()-]{7,20}"

    required

  />



  <label htmlFor="member-goal">Your fitness goal</label>

  <select id="member-goal" name="goal" defaultValue="">

    <option value="">Select your goal</option>

    <option value="Build muscle">Build muscle</option>

    <option value="Lose weight">Lose weight</option>

    <option value="Improve fitness">Improve fitness</option>

    <option value="General fitness">General fitness</option>

  </select>



  <button type="submit" className="button-primary form-submit">

    SEND MEMBERSHIP ENQUIRY

    <ArrowRight size={18} />

  </button>



  <p className="form-note">

    Your enquiry will be submitted securely to our server.

    Our team can follow up with you.

  </p>

</form>



  </div>

</section>





      <section className="timetable-section" id="timetable">

        <div className="timetable-heading">

          <p className="section-kicker">05 — PLAN YOUR SESSION</p>

          <p className="timetable-eyebrow">OUR WEEKLY GYM SCHEDULES</p>

          <h2>WORKOUT <span>TIMETABLE</span></h2>

          <p className="timetable-description">A sample weekly class timetable inspired by the schedule reference you shared. Please confirm class timings with the gym before visiting.</p>

        </div>



        <div className="timetable-wrap">

          <table className="workout-timetable">

            <thead>

              <tr>

                <th scope="col">TIME</th>

                <th scope="col">MON</th>

                <th scope="col">TUE</th>

                <th scope="col">WED</th>

                <th scope="col">THU</th>

                <th scope="col">FRI</th>

                <th scope="col">SAT</th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <th scope="row">05:30 AM</th>

                <td><strong>Cardio</strong><small>05:30 AM – 09:00 AM</small></td>

                <td><strong>Power Fitness</strong><small>05:30 AM – 09:00 AM</small></td>

                <td className="timetable-empty">—</td>

                <td><strong>Cardio</strong><small>05:30 AM – 09:00 AM</small></td>

                <td><strong>Power Fitness</strong><small>05:30 AM – 09:00 AM</small></td>

                <td className="timetable-empty">—</td>

              </tr>

              <tr>

                <th scope="row">09:00 AM</th>

                <td className="timetable-empty">—</td>

                <td className="timetable-empty">—</td>

                <td><strong>HIIT Group Class</strong><small>09:00 AM – 10:00 AM</small></td>

                <td><strong>Aerobic</strong><small>09:00 AM – 10:00 AM</small></td>

                <td className="timetable-empty">—</td>

                <td><strong>HIIT Group Class</strong><small>09:00 AM – 10:00 AM</small></td>

              </tr>

              <tr>

                <th scope="row">10:00 AM</th>

                <td className="timetable-empty">—</td>

                <td><strong>Boxing</strong><small>10:00 AM – 11:45 AM</small></td>

                <td><strong>Aerobic</strong><small>10:00 AM – 11:45 AM</small></td>

                <td className="timetable-empty">—</td>

                <td><strong>Body Work</strong><small>10:00 AM – 11:45 AM</small></td>

                <td className="timetable-empty">—</td>

              </tr>

              <tr>

                <th scope="row">04:00 PM</th>

                <td><strong>Boxing</strong><small>04:00 PM – 05:00 PM</small></td>

                <td><strong>Power Lifting</strong><small>05:00 PM – 06:00 PM</small></td>

                <td className="timetable-empty">—</td>

                <td><strong>Cardio</strong><small>06:00 PM – 09:00 PM</small></td>

                <td className="timetable-empty">—</td>

                <td><strong>HIIT</strong><small>04:00 PM – 05:00 PM</small></td>

              </tr>

            </tbody>

          </table>

        </div>

        <p className="timetable-footnote">Timetable details shown for website layout reference; verify the current schedule with Sylas Gym before publishing.</p>

      </section>



      {activePhoto && (

        <div

          className="photo-lightbox"

          role="dialog"

          aria-modal="true"

          aria-label={activePhoto.label}

          onClick={() => setActivePhoto(null)}

          onKeyDown={(event) => {

            if (event.key === 'Escape') setActivePhoto(null)

          }}

        >

          <button

            type="button"

            className="lightbox-close"

            aria-label="Close enlarged photo"

            onClick={() => setActivePhoto(null)}

          >

            <X size={24} />

          </button>

          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>

            <img src={activePhoto.src} alt={activePhoto.alt} />

            <p>{activePhoto.label}</p>

          </div>

        </div>

      )}





      <footer className="footer">

        <a href="#home" className="brand footer-brand">

  <img

    className="brand-logo"

    src="/images/sylas-gym-logo.png"

    alt="Sylas Gym logo"

  />

  <span className="brand-name">

    AURAFIT <span className="brand-accent">GYM</span>

  </span>

</a>

        <span>BORABANDA · HYDERABAD</span>

        <a href="#home">BACK TO TOP ↑</a>

      </footer>

    </main>

  )

}



export default App
