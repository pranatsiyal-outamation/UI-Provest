CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportUpdate_Insert]
    @id INT = NULL,
    @client_id INT = NULL,
    @lawfirm_filenumber NVARCHAR(500) = NULL,
    @thirdparty_filenumber NVARCHAR(500) = NULL,
    @plaintiff NVARCHAR(500) = NULL,
    @plaintiff2 NVARCHAR(500) = NULL,
    @defendant NVARCHAR(500) = NULL,
    @defendant2 NVARCHAR(500) = NULL,
    @document_code NVARCHAR(500) = NULL,
    @document_type NVARCHAR(500) = NULL,
    @index_number NVARCHAR(500) = NULL,
    @court_name NVARCHAR(500) = NULL,
    @court_type NVARCHAR(500) = NULL,
    @court_county NVARCHAR(500) = NULL,
    @court_city NVARCHAR(500) = NULL,
    @court_state NVARCHAR(500) = NULL,
    @court_zip NVARCHAR(500) = NULL,
    @servee_last_name NVARCHAR(500) = NULL,
    @servee_name NVARCHAR(500) = NULL,
    @servee_address NVARCHAR(500) = NULL,
    @servee_apt NVARCHAR(500) = NULL,
    @servee_city NVARCHAR(500) = NULL,
    @servee_state NVARCHAR(500) = NULL,
    @servee_zip NVARCHAR(500) = NULL,
    @servee_last_name2 NVARCHAR(500) = NULL,
    @servee_name2 NVARCHAR(500) = NULL,
    @servee_address2 NVARCHAR(500) = NULL,
    @servee_apt2 NVARCHAR(500) = NULL,
    @servee_city2 NVARCHAR(500) = NULL,
    @servee_state2 NVARCHAR(500) = NULL,
    @servee_zip2 NVARCHAR(500) = NULL,
    @employer_name NVARCHAR(500) = NULL,
    @employer_address1 NVARCHAR(500) = NULL,
    @employer_address2 NVARCHAR(500) = NULL,
    @employer_city NVARCHAR(500) = NULL,
    @employer_state NVARCHAR(500) = NULL,
    @employer_zip NVARCHAR(500) = NULL,
    @special_instructions NVARCHAR(MAX) = NULL,
    @additional_info1 NVARCHAR(500) = NULL,
    @additional_info2 NVARCHAR(500) = NULL,
    @additional_info3 NVARCHAR(500) = NULL,
    @additional_info4 NVARCHAR(500) = NULL,
    @additional_info5 NVARCHAR(500) = NULL,
    @kasebilling_checknum NVARCHAR(500) = NULL,
    @kasebilling_amt NVARCHAR(500) = NULL,
    @date_kase_filed NVARCHAR(500) = NULL,
    @court_date NVARCHAR(500) = NULL,
    @court_time NVARCHAR(500) = NULL,
    @court_room NVARCHAR(500) = NULL,
    @date_due NVARCHAR(500) = NULL,
    @client_ref NVARCHAR(500) = NULL,
    @creditor NVARCHAR(500) = NULL,
    @chargeoff_date NVARCHAR(500) = NULL,
    @suit_amt NVARCHAR(500) = NULL,
    @principal NVARCHAR(500) = NULL,
    @interest NVARCHAR(500) = NULL,
    @court_cost NVARCHAR(500) = NULL,
    @atty_cost NVARCHAR(500) = NULL,
    @client_data1 NVARCHAR(500) = NULL,
    @client_data2 NVARCHAR(500) = NULL,
    @client_data3 NVARCHAR(500) = NULL,
    @client_data4 NVARCHAR(500) = NULL,
    @client_data5 NVARCHAR(500) = NULL,
    @client_data6 NVARCHAR(500) = NULL,
    @client_data7 NVARCHAR(500) = NULL,
    @client_data8 NVARCHAR(500) = NULL,
    @date_prepaid_check NVARCHAR(500) = NULL,
    @def_ordinal NVARCHAR(500) = NULL,
    @court_room2 NVARCHAR(500) = NULL,
    @misc_1 NVARCHAR(500) = NULL,
    @dob NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- [id] is a plain nullable int with no identity or unique constraint, so it
        -- is supplied by the caller. Refuse to create a second row with an id that
        -- already exists -- that would make both rows uneditable.
        IF @id IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK) WHERE id = @id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51003, 'A Import_Update row with that id already exists.', 1;
        END

        INSERT INTO dbo.Import_Update
        (
            [id], [client_id], [lawfirm_filenumber], [3rdparty_filenumber], [plaintiff], [plaintiff2], [defendant], [defendant2], [document_code], [document_type], [index_number], [court_name], [court_type], [court_county], [court_city], [court_state], [court_zip], [servee_last_name], [servee_name], [servee_address], [servee_apt], [servee_city], [servee_state], [servee_zip], [servee_last_name2], [servee_name2], [servee_address2], [servee_apt2], [servee_city2], [servee_state2], [servee_zip2], [employer_name], [employer_address1], [employer_address2], [employer_city], [employer_state], [employer_zip], [special_instructions], [additional_info1], [additional_info2], [additional_info3], [additional_info4], [additional_info5], [kasebilling_checknum], [kasebilling_amt], [date_kase_filed], [court_date], [court_time], [court_room], [date_due], [client_ref], [creditor], [chargeoff_date], [suit_amt], [principal], [interest], [court_cost], [atty_cost], [client_data1], [client_data2], [client_data3], [client_data4], [client_data5], [client_data6], [client_data7], [client_data8], [date_prepaid_check], [def_ordinal], [court_room2], [misc_1], [dob]
        )
        VALUES
        (
            @id, @client_id, @lawfirm_filenumber, @thirdparty_filenumber, @plaintiff, @plaintiff2, @defendant, @defendant2, @document_code, @document_type, @index_number, @court_name, @court_type, @court_county, @court_city, @court_state, @court_zip, @servee_last_name, @servee_name, @servee_address, @servee_apt, @servee_city, @servee_state, @servee_zip, @servee_last_name2, @servee_name2, @servee_address2, @servee_apt2, @servee_city2, @servee_state2, @servee_zip2, @employer_name, @employer_address1, @employer_address2, @employer_city, @employer_state, @employer_zip, @special_instructions, @additional_info1, @additional_info2, @additional_info3, @additional_info4, @additional_info5, @kasebilling_checknum, @kasebilling_amt, @date_kase_filed, @court_date, @court_time, @court_room, @date_due, @client_ref, @creditor, @chargeoff_date, @suit_amt, @principal, @interest, @court_cost, @atty_cost, @client_data1, @client_data2, @client_data3, @client_data4, @client_data5, @client_data6, @client_data7, @client_data8, @date_prepaid_check, @def_ordinal, @court_room2, @misc_1, @dob
        );

        COMMIT TRANSACTION;

        SELECT @id AS id;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
