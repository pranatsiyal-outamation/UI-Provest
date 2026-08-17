CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Client_Update]
    @Id                     INT,
    @ClientName             VARCHAR(100)  = NULL,
    @ClientCode             VARCHAR(100)  = NULL,
    @InboundFolder          VARCHAR(MAX)  = NULL,
    @OutboundFolder         VARCHAR(MAX)  = NULL,
    @IsMergingEnabled       BIT           = 0,
    @IsActive               BIT           = 1,
    @StateColumn            VARCHAR(500)  = NULL,
    @UniqueColumns          VARCHAR(500)  = NULL,
    @IsZipExtractionEnabled BIT           = 0,
    @FileNumberColumn       VARCHAR(200)  = NULL,
    @ProjectSetupId         INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.ProVestClient WITH (UPDLOCK, HOLDLOCK) WHERE Id = @Id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No ProVestClient row found for the supplied id.', 1;
        END

        UPDATE dbo.ProVestClient
        SET ClientName             = @ClientName,
            ClientCode             = @ClientCode,
            InboundFolder          = @InboundFolder,
            OutboundFolder         = @OutboundFolder,
            IsMergingEnabled       = @IsMergingEnabled,
            IsActive               = @IsActive,
            StateColumn            = @StateColumn,
            UniqueColumns          = @UniqueColumns,
            IsZipExtractionEnabled = @IsZipExtractionEnabled,
            FileNumberColumn       = @FileNumberColumn,
            ProjectSetupId         = @ProjectSetupId
        WHERE Id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
