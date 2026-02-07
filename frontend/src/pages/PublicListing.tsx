import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { PublicListingData } from '../types';

export default function PublicListing() {
  const { slug } = useParams<{ slug: string }>();
  const [listing, setListing] = useState<PublicListingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lead form state
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.fetchPublicListing(slug)
      .then((data) => {
        if (data.success) {
          setListing(data.listing);
        } else {
          setError(data.error || 'Listing not found');
        }
      })
      .catch(() => setError('Failed to load listing'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSubmitting(true);
    setLeadError('');
    try {
      const res = await api.submitListingLead(slug, leadForm);
      if (res.success) {
        setSubmitted(true);
      } else {
        setLeadError(res.error || 'Failed to submit');
      }
    } catch {
      setLeadError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (!val) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const formatNumber = (val?: number | null) => {
    if (!val) return null;
    return new Intl.NumberFormat('en-US').format(val);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#B21F24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing Not Found</h1>
          <p className="text-gray-500">{error || 'This listing may have been removed or is no longer available.'}</p>
        </div>
      </div>
    );
  }

  const { property, transaction, photos, documents, broker } = listing;
  const primaryPhoto = photos.find(p => p.is_primary) || photos[0];
  const displayPrice = transaction?.sale_price || transaction?.asking_price;
  const fullAddress = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapsEmbedUrl = mapsApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(fullAddress)}`
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] bg-gray-900">
        {primaryPhoto ? (
          <img
            src={primaryPhoto.url}
            alt={property.property_name || property.address}
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <svg className="w-24 h-24 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            {listing.custom_headline ? (
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{listing.custom_headline}</h1>
            ) : (
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {property.property_name || property.address}
              </h1>
            )}
            <p className="text-lg text-gray-200">{fullAddress}</p>
            {displayPrice && (
              <p className="text-2xl font-bold text-white mt-3">{formatCurrency(displayPrice)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Bar */}
      <div className="bg-[#B21F24] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap gap-6 md:gap-10 justify-center text-center">
            {property.building_size && (
              <div>
                <div className="text-xl font-bold">{formatNumber(property.building_size)} SF</div>
                <div className="text-sm text-red-100">Building Size</div>
              </div>
            )}
            {property.lot_size_acres && (
              <div>
                <div className="text-xl font-bold">{property.lot_size_acres.toFixed(2)} AC</div>
                <div className="text-sm text-red-100">Lot Size</div>
              </div>
            )}
            {property.year_built && (
              <div>
                <div className="text-xl font-bold">{property.year_built}</div>
                <div className="text-sm text-red-100">Year Built</div>
              </div>
            )}
            {property.clear_height_ft && (
              <div>
                <div className="text-xl font-bold">{property.clear_height_ft} ft</div>
                <div className="text-sm text-red-100">Clear Height</div>
              </div>
            )}
            {transaction?.price_per_sf && (
              <div>
                <div className="text-xl font-bold">{formatCurrency(transaction.price_per_sf)}/SF</div>
                <div className="text-sm text-red-100">Price/SF</div>
              </div>
            )}
            {transaction?.cap_rate && (
              <div>
                <div className="text-xl font-bold">{transaction.cap_rate.toFixed(2)}%</div>
                <div className="text-sm text-red-100">CAP Rate</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left column: Details */}
          <div className="lg:col-span-2 space-y-10">
            {/* Photo Gallery */}
            {photos.length > 1 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Photos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxIndex(idx)}
                      className="aspect-[4/3] rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#B21F24]"
                    >
                      <img src={photo.url} alt={photo.caption || `Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Property Overview */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Property Overview</h2>
              {listing.custom_description ? (
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{listing.custom_description}</p>
              ) : (
                <p className="text-gray-500 italic">No description available.</p>
              )}
            </section>

            {/* Building Specs Table */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Building Specifications</h2>
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-200">
                    {[
                      ['Property Type', property.property_type ? property.property_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null],
                      ['Subtype', property.property_subtype ? property.property_subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null],
                      ['Building Size', property.building_size ? `${formatNumber(property.building_size)} SF` : null],
                      ['Lot Size', property.lot_size_acres ? `${property.lot_size_acres.toFixed(2)} Acres` : null],
                      ['Year Built', property.year_built],
                      ['Clear Height', property.clear_height_ft ? `${property.clear_height_ft} ft` : null],
                      ['Dock Doors', property.dock_doors],
                      ['Grade Doors', property.grade_doors],
                      ['Parking Spaces', property.parking_spaces],
                      ['Zoning', property.zoning],
                      ['Percent Leased', property.percent_leased != null ? `${property.percent_leased}%` : null],
                      ['Number of Floors', property.number_of_floors],
                    ].filter(([, val]) => val != null && val !== '').map(([label, value]) => (
                      <tr key={label as string}>
                        <td className="px-5 py-3 text-sm font-medium text-gray-600 w-1/2">{label}</td>
                        <td className="px-5 py-3 text-sm text-gray-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Transaction Details */}
            {transaction && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction Details</h2>
                <div className="bg-gray-50 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-200">
                      {[
                        ['Type', transaction.transaction_type ? transaction.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null],
                        ['Sale Price', formatCurrency(transaction.sale_price)],
                        ['Asking Price', formatCurrency(transaction.asking_price)],
                        ['Price/SF', transaction.price_per_sf ? `${formatCurrency(transaction.price_per_sf)}/SF` : null],
                        ['CAP Rate', transaction.cap_rate ? `${transaction.cap_rate.toFixed(2)}%` : null],
                        ['NOI', formatCurrency(transaction.noi)],
                        ['Date', transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : null],
                      ].filter(([, val]) => val != null).map(([label, value]) => (
                        <tr key={label as string}>
                          <td className="px-5 py-3 text-sm font-medium text-gray-600 w-1/2">{label}</td>
                          <td className="px-5 py-3 text-sm text-gray-900">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Location / Map */}
            {mapsEmbedUrl && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Location</h2>
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    title="Property location"
                    src={mapsEmbedUrl}
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </section>
            )}

            {/* Virtual Tour */}
            {listing.virtual_tour_url && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Virtual Tour</h2>
                <a
                  href={listing.virtual_tour_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#B21F24] text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  View Virtual Tour
                </a>
              </section>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Documents</h2>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <a
                      key={doc.id}
                      href={doc.file_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#B21F24]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                        <div className="text-xs text-gray-500 capitalize">{doc.template_type}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: Lead form + Broker card */}
          <div className="space-y-6">
            {/* Lead Capture Form */}
            <div className="bg-gray-50 rounded-xl p-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Interested in this property?</h3>
              <p className="text-sm text-gray-500 mb-5">Fill out the form and we'll get back to you shortly.</p>

              {submitted ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900">Thank you for your inquiry!</p>
                  <p className="text-sm text-gray-500 mt-1">We'll be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    required
                    value={leadForm.name}
                    onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B21F24] focus:border-transparent"
                  />
                  <input
                    type="email"
                    placeholder="Email Address *"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B21F24] focus:border-transparent"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B21F24] focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={leadForm.company}
                    onChange={e => setLeadForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B21F24] focus:border-transparent"
                  />
                  <textarea
                    placeholder="Message"
                    rows={3}
                    value={leadForm.message}
                    onChange={e => setLeadForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B21F24] focus:border-transparent resize-none"
                  />
                  {leadError && <p className="text-sm text-red-600">{leadError}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-[#B21F24] text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </form>
              )}
            </div>

            {/* Broker Contact Card */}
            {broker && (broker.full_name || broker.company_name) && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                {broker.company_logo_url && (
                  <img
                    src={broker.company_logo_url}
                    alt={broker.company_name || 'Company logo'}
                    className="h-10 mb-4 object-contain"
                  />
                )}
                {broker.full_name && <div className="font-semibold text-gray-900">{broker.full_name}</div>}
                {broker.company_name && <div className="text-sm text-gray-500">{broker.company_name}</div>}
                <div className="mt-3 space-y-1">
                  {broker.company_phone && (
                    <a href={`tel:${broker.company_phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#B21F24]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {broker.company_phone}
                    </a>
                  )}
                  {broker.company_email && (
                    <a href={`mailto:${broker.company_email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#B21F24]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {broker.company_email}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#B21F24] rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-sm">Powered by Apex Deal Analyzer</span>
          </div>
          {broker?.company_name && (
            <span className="text-sm">{broker.company_name}</span>
          )}
        </div>
      </footer>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 text-white hover:text-gray-300"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 text-white hover:text-gray-300"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].caption || `Photo ${lightboxIndex + 1}`}
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-white text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
